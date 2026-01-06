import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, In } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { TimeSlot } from '../doctor/entities/time-slot.entity';
import { AppointmentStatusEnum } from '../common/enums/appointment-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    const appointments = await this.appointmentRepository.find({
      relations: ['patient', 'doctor', 'hospital'],
    });
    return new ResponseCommon(
      200,
      'SUCCESS',
      appointments.map((a) => this.toDto(a)),
    );
  }

  async findById(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'hospital', 'department'],
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', this.toDto(appointment));
  }

  async findByPatient(
    patientId: string,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    const appointments = await this.appointmentRepository.find({
      where: { patientId },
      relations: ['doctor', 'hospital'],
      order: { scheduledAt: 'DESC' },
    });
    return new ResponseCommon(
      200,
      'SUCCESS',
      appointments.map((a) => this.toDto(a)),
    );
  }

  async findByDoctor(
    doctorId: string,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    const appointments = await this.appointmentRepository.find({
      where: { doctorId },
      relations: ['patient', 'hospital'],
      order: { scheduledAt: 'DESC' },
    });
    return new ResponseCommon(
      200,
      'SUCCESS',
      appointments.map((a) => this.toDto(a)),
    );
  }

  async create(
    data: Partial<Appointment>,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    if (!data.timeSlotId || !data.patientId || !data.doctorId) {
      throw new BadRequestException('Missing required fields');
    }

    return this.dataSource.transaction(async (manager) => {
      const slot = await manager.findOne(TimeSlot, {
        where: { id: data.timeSlotId },
        relations: ['doctor'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!slot) {
        throw new NotFoundException('Time slot không tồn tại');
      }

      // Validate doctor match
      if (slot.doctorId !== data.doctorId) {
        throw new BadRequestException('Time slot không thuộc về bác sĩ này');
      }

      if (!slot.isAvailable) {
        throw new ConflictException('Khung giờ không khả dụng');
      }

      if (slot.bookedCount >= slot.capacity) {
        throw new ConflictException('Khung giờ đã hết chỗ');
      }

      // Validate appointment type
      if (
        data.appointmentType &&
        !slot.allowedAppointmentTypes.includes(data.appointmentType)
      ) {
        throw new BadRequestException(
          `Loại hình ${data.appointmentType} không được hỗ trợ cho slot này`,
        );
      }

      // Check duplicate booking
      const existingAppointment = await manager.findOne(Appointment, {
        where: {
          patientId: data.patientId,
          timeSlotId: data.timeSlotId,
          status: Not(
            In([
              AppointmentStatusEnum.CANCELLED,
              AppointmentStatusEnum.NO_SHOW,
            ]),
          ),
        },
      });

      if (existingAppointment) {
        throw new ConflictException('Bạn đã đặt lịch slot này rồi');
      }

      // Create appointment
      const appointment = manager.create(Appointment, {
        ...data,
        appointmentNumber: this.generateAppointmentNumber(),
        scheduledAt: slot.startTime,
        durationMinutes: data.durationMinutes || 30,
        status: data.status || AppointmentStatusEnum.PENDING_PAYMENT,
        timezone: 'Asia/Ho_Chi_Minh',
      });

      const saved = await manager.save(appointment);

      // Update slot - auto-disable when full
      await manager
        .createQueryBuilder()
        .update(TimeSlot)
        .set({
          bookedCount: () => 'booked_count + 1',
          isAvailable: () =>
            `CASE WHEN booked_count + 1 >= capacity THEN false ELSE is_available END`,
        })
        .where('id = :id', { id: slot.id })
        .execute();

      return new ResponseCommon(
        201,
        'Tạo lịch hẹn thành công',
        this.toDto(saved),
      );
    });
  }

  async updateStatus(
    id: string,
    status: AppointmentStatusEnum,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointmentResponse = await this.findById(id);
    const appointment = appointmentResponse.data!;

    // Validate state transition
    const validTransitions: Record<
      AppointmentStatusEnum,
      AppointmentStatusEnum[]
    > = {
      [AppointmentStatusEnum.PENDING_PAYMENT]: [
        AppointmentStatusEnum.CONFIRMED,
        AppointmentStatusEnum.CANCELLED,
        AppointmentStatusEnum.PENDING,
      ],
      [AppointmentStatusEnum.PENDING]: [
        AppointmentStatusEnum.CONFIRMED,
        AppointmentStatusEnum.CANCELLED,
      ],
      [AppointmentStatusEnum.CONFIRMED]: [
        AppointmentStatusEnum.CHECKED_IN,
        AppointmentStatusEnum.IN_PROGRESS,
        AppointmentStatusEnum.CANCELLED,
        AppointmentStatusEnum.NO_SHOW,
        AppointmentStatusEnum.RESCHEDULED,
      ],
      [AppointmentStatusEnum.CHECKED_IN]: [
        AppointmentStatusEnum.IN_PROGRESS,
        AppointmentStatusEnum.CANCELLED,
        AppointmentStatusEnum.NO_SHOW,
      ],
      [AppointmentStatusEnum.IN_PROGRESS]: [
        AppointmentStatusEnum.COMPLETED,
        AppointmentStatusEnum.CANCELLED,
      ],
      [AppointmentStatusEnum.COMPLETED]: [], // Terminal state
      [AppointmentStatusEnum.CANCELLED]: [], // Terminal state
      [AppointmentStatusEnum.NO_SHOW]: [], // Terminal state
      [AppointmentStatusEnum.RESCHEDULED]: [
        AppointmentStatusEnum.CONFIRMED,
        AppointmentStatusEnum.CANCELLED,
      ],
    };

    const allowedNextStates = validTransitions[appointment.status] || [];
    if (!allowedNextStates.includes(status)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái ${appointment.status} sang ${status}`,
      );
    }

    // Update timestamps based on status
    const updateData: Partial<Appointment> = { status };
    if (status === AppointmentStatusEnum.IN_PROGRESS) {
      updateData.startedAt = new Date();
    } else if (status === AppointmentStatusEnum.COMPLETED) {
      updateData.endedAt = new Date();
    }

    await this.appointmentRepository.update(id, updateData);
    return this.findById(id);
  }

  /**
   * Cancel appointment with slot release
   */
  async cancel(
    id: string,
    reason: string,
    cancelledBy: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!appointment) {
        throw new NotFoundException(`Appointment not found`);
      }

      // Cannot cancel completed appointments
      if (appointment.status === AppointmentStatusEnum.COMPLETED) {
        throw new BadRequestException('Không thể hủy lịch hẹn đã hoàn thành');
      }

      // Cannot cancel already cancelled appointments
      if (appointment.status === AppointmentStatusEnum.CANCELLED) {
        throw new BadRequestException('Lịch hẹn đã được hủy trước đó');
      }

      if (appointment.status === AppointmentStatusEnum.NO_SHOW) {
        throw new BadRequestException(
          'Không thể hủy lịch hẹn đã đánh dấu no-show',
        );
      }

      // Release the time slot if exists
      if (appointment.timeSlotId) {
        await manager
          .createQueryBuilder()
          .update(TimeSlot)
          .set({
            bookedCount: () => 'GREATEST(booked_count - 1, 0)',
            isAvailable: true,
          })
          .where('id = :id', { id: appointment.timeSlotId })
          .execute();
      }

      // Update appointment status
      appointment.status = AppointmentStatusEnum.CANCELLED;
      appointment.cancelledAt = new Date();
      appointment.cancellationReason = reason;
      appointment.cancelledBy = cancelledBy;

      return manager.save(appointment);
    });
    return new ResponseCommon(
      200,
      'Hủy lịch hẹn thành công',
      this.toDto(result),
    );
  }

  /**
   * Reschedule appointment to a new time slot
   */
  async reschedule(
    appointmentId: string,
    newTimeSlotId: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.dataSource.transaction(async (manager) => {
      // Lock appointment and both slots
      const appointment = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!appointment) {
        throw new NotFoundException('Appointment không tồn tại');
      }

      if (
        ![
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ].includes(appointment.status)
      ) {
        throw new BadRequestException('Không thể đổi lịch ở trạng thái này');
      }

      const oldSlot = appointment.timeSlotId
        ? await manager.findOne(TimeSlot, {
            where: { id: appointment.timeSlotId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;

      const newSlot = await manager.findOne(TimeSlot, {
        where: { id: newTimeSlotId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!newSlot) {
        throw new NotFoundException('Time slot mới không tồn tại');
      }

      // Validate new slot
      if (newSlot.doctorId !== appointment.doctorId) {
        throw new BadRequestException('Slot mới phải cùng bác sĩ');
      }

      if (
        appointment.appointmentType &&
        !newSlot.allowedAppointmentTypes.includes(appointment.appointmentType)
      ) {
        throw new BadRequestException(
          `Slot mới không hỗ trợ loại hình ${appointment.appointmentType}`,
        );
      }

      const duplicateInNewSlot = await manager.findOne(Appointment, {
        where: {
          patientId: appointment.patientId,
          timeSlotId: newTimeSlotId,
          status: Not(
            In([
              AppointmentStatusEnum.CANCELLED,
              AppointmentStatusEnum.NO_SHOW,
            ]),
          ),
        },
      });

      if (duplicateInNewSlot) {
        throw new ConflictException('Bạn đã có lịch hẹn trong slot mới này');
      }

      if (!newSlot.isAvailable) {
        throw new ConflictException('Slot mới không khả dụng');
      }

      if (newSlot.bookedCount >= newSlot.capacity) {
        throw new ConflictException('Slot mới đã đầy');
      }

      if (newSlot.startTime < new Date()) {
        throw new BadRequestException('Không thể đặt slot quá khứ');
      }

      // Release old slot
      if (oldSlot) {
        await manager
          .createQueryBuilder()
          .update(TimeSlot)
          .set({
            bookedCount: () => 'GREATEST(booked_count - 1, 0)',
            isAvailable: true,
          })
          .where('id = :id', { id: oldSlot.id })
          .execute();
      }

      // Book new slot
      await manager
        .createQueryBuilder()
        .update(TimeSlot)
        .set({
          bookedCount: () => 'booked_count + 1',
          isAvailable: () =>
            `CASE WHEN booked_count + 1 >= capacity THEN false ELSE is_available END`,
        })
        .where('id = :id', { id: newSlot.id })
        .execute();

      // Update appointment
      appointment.timeSlotId = newTimeSlotId;
      appointment.scheduledAt = newSlot.startTime;
      appointment.status = AppointmentStatusEnum.RESCHEDULED;

      return manager.save(appointment);
    });
    return new ResponseCommon(
      200,
      'Đổi lịch hẹn thành công',
      this.toDto(result),
    );
  }

  /**
   * Mark appointment as no-show and release the slot
   */
  async markNoShow(
    id: string,
    markedBy: string = 'SYSTEM',
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!appointment) {
        throw new NotFoundException('Appointment không tồn tại');
      }

      if (
        appointment.status !== AppointmentStatusEnum.CONFIRMED &&
        appointment.status !== AppointmentStatusEnum.CHECKED_IN
      ) {
        throw new BadRequestException(
          'Chỉ có thể mark no-show cho lịch hẹn đã confirm',
        );
      }

      // Release slot
      if (appointment.timeSlotId) {
        await manager
          .createQueryBuilder()
          .update(TimeSlot)
          .set({
            bookedCount: () => 'GREATEST(booked_count - 1, 0)',
            isAvailable: true,
          })
          .where('id = :id', { id: appointment.timeSlotId })
          .execute();
      }

      appointment.status = AppointmentStatusEnum.NO_SHOW;
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = markedBy;
      return manager.save(appointment);
    });
    return new ResponseCommon(
      200,
      'Đánh dấu no-show thành công',
      this.toDto(result),
    );
  }

  /**
   * Convert entity to DTO
   */
  private toDto(entity: Appointment): AppointmentResponseDto {
    return {
      id: entity.id,
      appointmentNumber: entity.appointmentNumber,
      patientId: entity.patientId,
      doctorId: entity.doctorId,
      hospitalId: entity.hospitalId,
      timeSlotId: entity.timeSlotId,
      appointmentType: entity.appointmentType,
      scheduledAt: entity.scheduledAt,
      durationMinutes: entity.durationMinutes,
      timezone: entity.timezone,
      status: entity.status,
      feeAmount: entity.feeAmount,
      paidAmount: entity.paidAmount,
      paymentId: entity.paymentId,
      refunded: entity.refunded,
      meetingRoomId: entity.meetingRoomId,
      meetingUrl: entity.meetingUrl,
      chiefComplaint: entity.chiefComplaint,
      symptoms: entity.symptoms,
      patientNotes: entity.patientNotes,
      doctorNotes: entity.doctorNotes,
      checkInTime: entity.checkInTime,
      startedAt: entity.startedAt,
      endedAt: entity.endedAt,
      cancelledAt: entity.cancelledAt,
      cancellationReason: entity.cancellationReason,
      cancelledBy: entity.cancelledBy,
      followUpRequired: entity.followUpRequired,
      nextAppointmentDate: entity.nextAppointmentDate,
      patientRating: entity.patientRating,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private generateAppointmentNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `APT-${timestamp}-${random}`;
  }
}
