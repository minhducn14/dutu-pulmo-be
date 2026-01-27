import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  Not,
  In,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { TimeSlot } from '../doctor/entities/time-slot.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { DoctorSchedule } from '../doctor/entities/doctor-schedule.entity';
import { AppointmentStatusEnum } from '../common/enums/appointment-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import {
  AppointmentResponseDto,
  AppointmentStatisticsDto,
  DoctorQueueDto,
  PaginatedAppointmentResponseDto,
} from './dto/appointment-response.dto';
import {
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
} from './dto/appointment-query.dto';
import { AppointmentTypeEnum } from '../common/enums/appointment-type.enum';
import { AppointmentSubTypeEnum } from '../common/enums/appointment-sub-type.enum';
import { SourceTypeEnum } from '../common/enums/source-type.enum';
import { DailyService } from '../video_call/daily.service';
import { CallStateService } from '../video_call/call-state.service';
import { CompleteExaminationDto } from './dto/update-appointment.dto';

const BASE_RELATIONS = ['patient', 'doctor', 'hospital', 'timeSlot'];

const AUTH_RELATIONS = [
  'patient',
  'patient.user',
  'doctor',
  'doctor.user',
  'hospital',
  'timeSlot',
];

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    private readonly dataSource: DataSource,
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
  ) {}

  /**
   * Helper: Parse fee value safely
   */
  private getFee(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  async findAll(
    query?: AppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    // Build where conditions
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.appointmentType) {
      where.appointmentType = query.appointmentType;
    }

    if (query?.startDate && query?.endDate) {
      where.scheduledAt = Between(
        new Date(query.startDate),
        new Date(query.endDate),
      );
    } else if (query?.startDate) {
      where.scheduledAt = MoreThanOrEqual(new Date(query.startDate));
    } else if (query?.endDate) {
      where.scheduledAt = LessThanOrEqual(new Date(query.endDate));
    }

    const [appointments, totalItems] =
      await this.appointmentRepository.findAndCount({
        where,
        relations: BASE_RELATIONS,
        order: { scheduledAt: 'DESC' },
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: appointments.map((a) => this.toDto(a)),
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  }

  async findById(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: BASE_RELATIONS,
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', this.toDto(appointment));
  }

  /**
   * Find appointment by ID (returns entity for internal use)
   * Uses AUTH_RELATIONS for authorization checks
   */
  async findOne(id: string): Promise<Appointment | null> {
    return this.appointmentRepository.findOne({
      where: { id },
      relations: AUTH_RELATIONS,
    });
  }

  async findByPatient(
    patientId: string,
    query?: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { patientId };

    if (query?.status) {
      where.status = query.status;
    }

    const [appointments, totalItems] =
      await this.appointmentRepository.findAndCount({
        where,
        relations: BASE_RELATIONS,
        order: { scheduledAt: 'DESC' },
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: appointments.map((a) => this.toDto(a)),
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  }

  async findByDoctor(
    doctorId: string,
    query?: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { doctorId };

    if (query?.status) {
      where.status = query.status;
    }

    const [appointments, totalItems] =
      await this.appointmentRepository.findAndCount({
        where,
        relations: BASE_RELATIONS,
        order: { scheduledAt: 'DESC' },
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: appointments.map((a) => this.toDto(a)),
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  }

  async create(
    data: Partial<Appointment>,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    if (!data.timeSlotId || !data.patientId) {
      throw new BadRequestException(
        'Missing required fields: timeSlotId, patientId',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Lock slot WITHOUT relation
      const slot = await manager
        .createQueryBuilder(TimeSlot, 'slot')
        .setLock('pessimistic_write', undefined, ['slot'])
        .leftJoinAndSelect('slot.doctor', 'doctor')
        .leftJoinAndSelect('slot.schedule', 'schedule')
        .where('slot.id = :id', { id: data.timeSlotId })
        .getOne();

      if (!slot) {
        throw new NotFoundException('Time slot không tồn tại');
      }

      // 2. Fetch schedule separately (after lock)
      const schedule = slot.scheduleId
        ? await manager.findOne(DoctorSchedule, {
            where: { id: slot.scheduleId },
          })
        : null;

      // 3. Validate slot availability
      if (!slot.isAvailable) {
        throw new ConflictException('Khung giờ không khả dụng');
      }

      if (slot.bookedCount >= slot.capacity) {
        throw new ConflictException('Khung giờ đã hết chỗ');
      }

      // 3. Validate not in the past
      if (slot.startTime < new Date()) {
        throw new BadRequestException('Không thể đặt lịch cho slot quá khứ');
      }

      // 4. Check duplicate with lock (FIXED RACE CONDITION)
      const existingAppointment = await manager.findOne(Appointment, {
        where: {
          patientId: data.patientId,
          timeSlotId: data.timeSlotId,
          status: Not(In([AppointmentStatusEnum.CANCELLED])),
        },
        lock: { mode: 'pessimistic_read' },
      });

      if (existingAppointment) {
        throw new ConflictException('Bạn đã đặt lịch slot này rồi');
      }

      // 5. Validate and determine appointment type
      if (!slot.allowedAppointmentTypes?.length) {
        throw new BadRequestException(
          'Slot chưa được cấu hình appointment type',
        );
      }

      const appointmentType = slot.allowedAppointmentTypes[0];

      if (!slot.allowedAppointmentTypes.includes(appointmentType)) {
        throw new BadRequestException(
          `Slot không hỗ trợ ${appointmentType}. Chỉ hỗ trợ: ${slot.allowedAppointmentTypes.join(', ')}`,
        );
      }

      // Fetch doctor for fee calculation and hospitalId
      const doctor = await manager.findOne(Doctor, {
        where: { id: slot.doctorId },
      });

      // 6. Handle IN_CLINIC specific logic - auto-assign hospitalId
      let hospitalId = data.hospitalId;
      if (appointmentType === AppointmentTypeEnum.IN_CLINIC && !hospitalId) {
        hospitalId = doctor?.primaryHospitalId || undefined;
      }

      // 7. Calculate fee with robust parsing (use separately fetched schedule)
      let baseFee = this.getFee(schedule?.consultationFee);
      if (baseFee === 0) {
        baseFee = this.getFee(doctor?.defaultConsultationFee);
      }

      const discountPercent = schedule?.discountPercent || 0;
      let finalFee = baseFee;

      if (discountPercent > 0 && baseFee > 0) {
        finalFee = baseFee * ((100 - discountPercent) / 100);
      }

      finalFee = Math.floor(finalFee);
      const feeAmount = String(finalFee);
      const isFree = finalFee === 0;

      // 8. Sync time from slot
      const scheduledAt = slot.startTime;
      const durationMinutes = Math.floor(
        (slot.endTime.getTime() - slot.startTime.getTime()) / 60000,
      );

      if (durationMinutes <= 0) {
        throw new BadRequestException('Slot có thời gian không hợp lệ');
      }

      // 9. Create appointment
      const appointment = manager.create(Appointment, {
        appointmentNumber: this.generateAppointmentNumber(),
        patientId: data.patientId,
        doctorId: slot.doctorId,
        hospitalId: slot.doctor.primaryHospitalId,
        timeSlotId: slot.id,
        scheduledAt,
        durationMinutes,
        timezone: slot.timezone || 'Asia/Ho_Chi_Minh',
        appointmentType,
        subType: data.subType || AppointmentSubTypeEnum.SCHEDULED,
        sourceType: data.sourceType || SourceTypeEnum.EXTERNAL,
        feeAmount,
        paidAmount: '0',
        status: isFree
          ? AppointmentStatusEnum.CONFIRMED
          : AppointmentStatusEnum.PENDING_PAYMENT,
        chiefComplaint: data.chiefComplaint,
        symptoms: data.symptoms,
        patientNotes: data.patientNotes,
        bookedByUserId: data.bookedByUserId,
      });

      const saved = await manager.save(appointment);

      // 10. Update slot - increment count
      await manager.increment(TimeSlot, { id: slot.id }, 'bookedCount', 1);

      // 11. Auto-disable if full
      if (slot.bookedCount + 1 >= slot.capacity) {
        await manager.update(TimeSlot, { id: slot.id }, { isAvailable: false });
      }

      // 12. Auto-generate meeting URL if FREE VIDEO appointment
      if (isFree && appointmentType === AppointmentTypeEnum.VIDEO) {
        try {
          const room = await this.dailyService.getOrCreateRoom(saved.id);
          saved.meetingUrl = room.url;
          saved.dailyCoChannel = room.name;
          await manager.save(saved);
          this.logger.log(
            `Auto-generated meeting URL for free appointment ${saved.id}`,
          );
        } catch (error) {
          this.logger.error(`Failed to generate meeting URL: ${error}`);
          // Don't fail the entire booking if video creation fails
        }
      }

      return new ResponseCommon(
        201,
        'Tạo lịch hẹn thành công',
        this.toDto(saved),
      );
    });
  }

  /**
   * UPDATE STATUS - Generate meeting URL when CONFIRMED for VIDEO appointments
   */
  async updateStatus(
    id: string,
    status: AppointmentStatusEnum,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.findOne(id);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

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
      ],
      [AppointmentStatusEnum.CHECKED_IN]: [
        AppointmentStatusEnum.IN_PROGRESS,
        AppointmentStatusEnum.CANCELLED,
      ],
      [AppointmentStatusEnum.IN_PROGRESS]: [
        AppointmentStatusEnum.COMPLETED,
        AppointmentStatusEnum.CANCELLED,
      ],
      [AppointmentStatusEnum.COMPLETED]: [],
      [AppointmentStatusEnum.CANCELLED]: [],
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

    // Prepare update data
    const updateData: Partial<Appointment> = { status };

    // Handle status-specific logic
    if (status === AppointmentStatusEnum.CONFIRMED) {
      // Generate meeting URL for VIDEO appointments
      if (
        appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
        !appointment.meetingUrl
      ) {
        try {
          const room = await this.dailyService.getOrCreateRoom(appointment.id);
          updateData.meetingUrl = room.url;
          updateData.dailyCoChannel = room.name;
          this.logger.log(
            `Generated meeting URL for appointment ${appointment.id}`,
          );
        } catch (error) {
          this.logger.error(`Failed to generate meeting URL: ${error}`);
          throw new BadRequestException('Không thể tạo phòng họp video');
        }
      }
    } else if (status === AppointmentStatusEnum.IN_PROGRESS) {
      updateData.startedAt = new Date();
    } else if (status === AppointmentStatusEnum.COMPLETED) {
      updateData.endedAt = new Date();

      // Clean up video room after completion
      if (
        appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
        appointment.dailyCoChannel
      ) {
        try {
          await this.dailyService.deleteRoom(appointment.dailyCoChannel);
          await this.callStateService.clearCallsForAppointment(appointment.id);
          this.logger.log(
            `Cleaned up video room for appointment ${appointment.id}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to cleanup video room: ${error}`);
        }
      }
    }

    await this.appointmentRepository.update(id, updateData);
    return this.findById(id);
  }

  /**
   * Cancel appointment with slot release and video cleanup
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

      if (appointment.status === AppointmentStatusEnum.COMPLETED) {
        throw new BadRequestException('Không thể hủy lịch hẹn đã hoàn thành');
      }

      if (appointment.status === AppointmentStatusEnum.CANCELLED) {
        throw new BadRequestException('Lịch hẹn đã được hủy trước đó');
      }

      // Release the time slot
      if (appointment.timeSlotId) {
        await manager.decrement(
          TimeSlot,
          { id: appointment.timeSlotId },
          'bookedCount',
          1,
        );

        const slot = await manager.findOne(TimeSlot, {
          where: { id: appointment.timeSlotId },
        });

        if (slot && slot.bookedCount < slot.capacity) {
          await manager.update(
            TimeSlot,
            { id: slot.id },
            { isAvailable: true },
          );
        }
      }

      // Update appointment status
      appointment.status = AppointmentStatusEnum.CANCELLED;
      appointment.cancelledAt = new Date();
      appointment.cancellationReason = reason;
      appointment.cancelledBy = cancelledBy;

      const saved = await manager.save(appointment);

      // Cleanup video room if exists
      if (
        appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
        appointment.dailyCoChannel
      ) {
        try {
          await this.dailyService.deleteRoom(appointment.dailyCoChannel);
          await this.callStateService.clearCallsForAppointment(appointment.id);
          this.logger.log(
            `Cleaned up video room for cancelled appointment ${appointment.id}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to cleanup video room: ${error}`);
        }
      }

      return saved;
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

      if (newSlot.doctorId !== appointment.doctorId) {
        throw new BadRequestException('Slot mới phải cùng bác sĩ');
      }

      if (newSlot.startTime < new Date()) {
        throw new BadRequestException('Không thể đặt slot quá khứ');
      }

      if (!newSlot.allowedAppointmentTypes?.length) {
        throw new BadRequestException(
          'Slot mới chưa được cấu hình appointment type',
        );
      }

      if (
        !newSlot.allowedAppointmentTypes.includes(appointment.appointmentType)
      ) {
        throw new BadRequestException(
          `Slot mới không hỗ trợ ${appointment.appointmentType}. ` +
            `Chỉ hỗ trợ: ${newSlot.allowedAppointmentTypes.join(', ')}`,
        );
      }

      // Check duplicate with lock
      const duplicateInNewSlot = await manager.findOne(Appointment, {
        where: {
          patientId: appointment.patientId,
          timeSlotId: newTimeSlotId,
          status: Not(In([AppointmentStatusEnum.CANCELLED])),
        },
        lock: { mode: 'pessimistic_read' },
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

      // Release old slot
      if (oldSlot) {
        await manager.decrement(TimeSlot, { id: oldSlot.id }, 'bookedCount', 1);
        if (oldSlot.bookedCount - 1 < oldSlot.capacity) {
          await manager.update(
            TimeSlot,
            { id: oldSlot.id },
            { isAvailable: true },
          );
        }
      }

      // Book new slot
      await manager.increment(TimeSlot, { id: newSlot.id }, 'bookedCount', 1);
      if (newSlot.bookedCount + 1 >= newSlot.capacity) {
        await manager.update(
          TimeSlot,
          { id: newSlot.id },
          { isAvailable: false },
        );
      }

      // SYNC scheduledAt and durationMinutes from new slot
      appointment.timeSlotId = newTimeSlotId;
      appointment.scheduledAt = newSlot.startTime;
      appointment.durationMinutes = Math.floor(
        (newSlot.endTime.getTime() - newSlot.startTime.getTime()) / 60000,
      );

      return manager.save(appointment);
    });

    return new ResponseCommon(
      200,
      'Đổi lịch hẹn thành công',
      this.toDto(result),
    );
  }

  async confirmPayment(
    appointmentId: string,
    paymentId: string,
    paidAmount?: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.findOne(appointmentId);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== AppointmentStatusEnum.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Không thể xác nhận thanh toán cho lịch hẹn ở trạng thái ${appointment.status}`,
      );
    }

    const updateData: Partial<Appointment> = {
      paymentId,
      paidAmount: paidAmount || appointment.feeAmount,
      status: AppointmentStatusEnum.CONFIRMED,
    };

    if (appointment.appointmentType === AppointmentTypeEnum.VIDEO) {
      try {
        const room = await this.dailyService.getOrCreateRoom(appointmentId);
        updateData.meetingUrl = room.url;
        updateData.dailyCoChannel = room.name;
        this.logger.log(
          `Generated meeting URL for paid appointment ${appointmentId}`,
        );
      } catch (error) {
        this.logger.error(`Failed to generate meeting URL: ${error}`);
        throw new BadRequestException('Không thể tạo phòng họp video');
      }
    }

    await this.appointmentRepository.update(appointmentId, updateData);

    this.logger.log(
      `Payment confirmed for appointment ${appointmentId}, paymentId: ${paymentId}`,
    );

    return this.findById(appointmentId);
  }

  private toDto(entity: Appointment): AppointmentResponseDto {
    return {
      id: entity.id,
      appointmentNumber: entity.appointmentNumber,
      patientId: entity.patientId,
      doctorId: entity.doctorId,
      hospitalId: entity.hospitalId,
      timeSlotId: entity.timeSlotId,
      scheduledAt: entity.scheduledAt,
      durationMinutes: entity.durationMinutes,
      timezone: entity.timezone,
      status: entity.status,
      appointmentType: entity.appointmentType,
      subType: entity.subType,
      sourceType: entity.sourceType,
      feeAmount: entity.feeAmount,
      paidAmount: entity.paidAmount,
      paymentId: entity.paymentId,
      refunded: entity.refunded,
      meetingRoomId: entity.meetingRoomId,
      meetingUrl: entity.meetingUrl,
      dailyCoChannel: entity.dailyCoChannel,
      // roomNumber: entity.roomNumber,
      queueNumber: entity.queueNumber,
      // floor: entity.floor,
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
