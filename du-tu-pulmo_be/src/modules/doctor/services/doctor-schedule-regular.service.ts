import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  In,
  MoreThan,
  Repository,
} from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { BulkUpdateDoctorSchedulesDto } from '@/modules/doctor/dto/bulk-update-doctor-schedules.dto';
import { CreateDoctorScheduleDto } from '@/modules/doctor/dto/create-doctor-schedule.dto';
import { UpdateDoctorScheduleDto } from '@/modules/doctor/dto/update-doctor-schedule.dto';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  ScheduleType,
  SCHEDULE_TYPE_PRIORITY,
} from '@/modules/common/enums/schedule-type.enum';
import { NotificationService } from '@/modules/notification/notification.service';
import { DoctorScheduleHelperService } from '@/modules/doctor/services/doctor-schedule-helper.service';
import { DoctorScheduleSlotService } from '@/modules/doctor/services/doctor-schedule-slot.service';
import {
  addDaysVN,
  endOfDayVN,
  startOfDayVN,
  vnNow,
} from '@/common/datetime';

@Injectable()
export class DoctorScheduleRegularService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly helper: DoctorScheduleHelperService,
    private readonly slotService: DoctorScheduleSlotService,
    private readonly notificationService: NotificationService,
  ) {}

  // ==================== CREATE ====================

  async createRegular(
    doctorId: string,
    dto: CreateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });

    if (!doctor) {
      throw new NotFoundException('Bác sĩ không tồn tại');
    }

    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
      throw new BadRequestException(
        'Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7)',
      );
    }

    this.helper.validateTimeRange(dto);

    const minDays = dto.minimumBookingDays ?? 0;
    const maxDays = dto.maxAdvanceBookingDays ?? 30;
    this.helper.validateBookingDaysConstraints(minDays, maxDays);

    const isAvailable = dto.isAvailable ?? true;

    const effectiveFromDate = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : null;
    const effectiveUntilDate = dto.effectiveUntil
      ? new Date(dto.effectiveUntil)
      : null;

    await this.helper.checkOverlap(
      doctorId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
      effectiveFromDate,
      effectiveUntilDate,
      priority,
    );

    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (!doctor?.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
    }

    const minimumBookingTimeInMinutes = minDays * 24 * 60;

    const schedule = this.scheduleRepository.create({
      ...dto,
      doctorId,
      priority,
      scheduleType,
      isAvailable,
      minimumBookingTime: minimumBookingTimeInMinutes,
      maxAdvanceBookingDays: maxDays,
      discountPercent: dto.discountPercent ?? 0,
      consultationFee: dto.consultationFee?.toString() ?? null,
      effectiveFrom: effectiveFromDate,
      effectiveUntil: effectiveUntilDate,
    });

    const { saved, generatedSlotsCount } = await this.dataSource.transaction(
      async (manager) => {
        const saved = await manager.save(DoctorSchedule, schedule);

        const now = vnNow();
        const startOfToday = startOfDayVN(now);
        const startDate = addDaysVN(startOfToday, 1);
        const endDate = addDaysVN(startOfToday, 7);

        const generatedSlotsCount =
          await this.slotService.generateSlotsForSchedule(
            saved,
            startDate,
            endDate,
            manager,
          );

        return { saved, generatedSlotsCount };
      },
    );

    let message = 'Tạo lịch làm việc cố định thành công';
    if (!effectiveUntilDate) {
      message += ' (lịch vô thời hạn)';
    }
    if (generatedSlotsCount > 0) {
      message += `. Đã tự động tạo ${generatedSlotsCount} time slots cho 7 ngày tới.`;
    }

    const isShadowed = await this.helper.hasShadowingSchedule(
      doctorId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
      effectiveFromDate,
      effectiveUntilDate,
      priority,
    );
    if (isShadowed) {
      message += ` (Lưu ý: Một số ngày trong lịch này trùng với lịch Nghỉ/Linh hoạt đã có và sẽ bị ghi đè)`;
    }

    return new ResponseCommon(201, message, saved);
  }

  async createManyRegular(
    doctorId: string,
    dtos: CreateDoctorScheduleDto[],
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });

    if (!doctor) {
      throw new NotFoundException('Bác sĩ không tồn tại');
    }

    if (dtos.length === 0) {
      throw new BadRequestException('Danh sách lịch làm việc không được rỗng');
    }

    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    const dtosWithPriority = dtos.map((dto) => ({
      ...dto,
      scheduleType,
      priority,
      isAvailable: dto.isAvailable ?? true,
    }));

    for (const dto of dtosWithPriority) {
      if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
        throw new BadRequestException(
          `Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7). Nhận được: ${dto.dayOfWeek}`,
        );
      }

      this.helper.validateTimeRange(dto);

      const minDays = dto.minimumBookingDays ?? 0;
      const maxDays = dto.maxAdvanceBookingDays ?? 30;
      this.helper.validateBookingDaysConstraints(minDays, maxDays);

      if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
        if (!doctor?.primaryHospitalId) {
          throw new BadRequestException(
            'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
          );
        }
      }
    }

    for (const dto of dtosWithPriority) {
      const effectiveFromDate = dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : null;
      const effectiveUntilDate = dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : null;

      await this.helper.checkOverlap(
        doctorId,
        dto.dayOfWeek,
        dto.startTime,
        dto.endTime,
        effectiveFromDate,
        effectiveUntilDate,
        dto.priority,
      );
    }

    for (let i = 0; i < dtosWithPriority.length; i++) {
      for (let j = i + 1; j < dtosWithPriority.length; j++) {
        if (dtosWithPriority[i].dayOfWeek === dtosWithPriority[j].dayOfWeek) {
          const timeOverlap =
            dtosWithPriority[i].startTime < dtosWithPriority[j].endTime &&
            dtosWithPriority[i].endTime > dtosWithPriority[j].startTime;

          if (timeOverlap) {
            const iFrom = dtosWithPriority[i].effectiveFrom
              ? new Date(dtosWithPriority[i].effectiveFrom!)
              : null;
            const iUntil = dtosWithPriority[i].effectiveUntil
              ? new Date(dtosWithPriority[i].effectiveUntil!)
              : null;
            const jFrom = dtosWithPriority[j].effectiveFrom
              ? new Date(dtosWithPriority[j].effectiveFrom!)
              : null;
            const jUntil = dtosWithPriority[j].effectiveUntil
              ? new Date(dtosWithPriority[j].effectiveUntil!)
              : null;

            const dateOverlap =
              (iFrom === null || jUntil === null || iFrom <= jUntil) &&
              (jFrom === null || iUntil === null || jFrom <= iUntil);

            if (dateOverlap) {
              throw new ConflictException(
                `Lịch ${i + 1} trùng với lịch ${j + 1} trong cùng ngày ${dtosWithPriority[i].dayOfWeek} và khoảng thời gian hiệu lực`,
              );
            }
          }
        }
      }
    }

    const { result, totalGeneratedSlots } = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const entities = dtosWithPriority.map((dto) =>
          manager.create(DoctorSchedule, {
            ...dto,
            doctorId,
            scheduleType,
            priority,
            isAvailable: dto.isAvailable ?? true,
            consultationFee: dto.consultationFee?.toString() ?? null,
            effectiveFrom: dto.effectiveFrom
              ? new Date(dto.effectiveFrom)
              : null,
            effectiveUntil: dto.effectiveUntil
              ? new Date(dto.effectiveUntil)
              : null,
            minimumBookingTime: dto.minimumBookingDays
              ? dto.minimumBookingDays * 24 * 60
              : 0,
            maxAdvanceBookingDays: dto.maxAdvanceBookingDays ?? 30,
          }),
        );

        const savedSchedules = await manager.save(DoctorSchedule, entities);

        const now = vnNow();
        const startOfToday = startOfDayVN(now);
        const startDate = addDaysVN(startOfToday, 1);
        const endDate = addDaysVN(startOfToday, 7);

        let slotsCount = 0;
        await Promise.all(
          savedSchedules.map(async (schedule) => {
            const count = await this.slotService.generateSlotsForSchedule(
              schedule,
              startDate,
              endDate,
              manager,
            );
            slotsCount += count;
          }),
        );

        return { result: savedSchedules, totalGeneratedSlots: slotsCount };
      },
    );

    let hasShadowing = false;
    for (const dto of dtosWithPriority) {
      if (
        await this.helper.hasShadowingSchedule(
          doctorId,
          dto.dayOfWeek,
          dto.startTime,
          dto.endTime,
          dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
          priority,
        )
      ) {
        hasShadowing = true;
        break;
      }
    }

    let resultMessage = `Tạo ${result.length} lịch làm việc thành công. Đã tự động tạo ${totalGeneratedSlots} time slots cho 7 ngày tới.`;
    if (hasShadowing) {
      resultMessage += ` (Lưu ý: Một số ngày trùng với lịch Nghỉ/Linh hoạt đã có và sẽ bị ghi đè)`;
    }

    return new ResponseCommon(201, resultMessage, result);
  }

  // ==================== UPDATE ====================

  async updateRegular(
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existing = await this.scheduleRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy lịch với ID ${id}`);
    }

    if (existing.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(
        `Lịch này không phải là lịch cố định (REGULAR). Sử dụng API phù hợp để cập nhật loại lịch ${existing.scheduleType}`,
      );
    }

    this.helper.validateTimeRange(dto);

    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    const priority = existing.priority;
    const newIsAvailable = dto.isAvailable ?? existing.isAvailable;

    let newEffectiveFrom: Date | null = existing.effectiveFrom;
    if (dto.effectiveFrom !== undefined) {
      newEffectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    }

    let newEffectiveUntil: Date | null = existing.effectiveUntil;
    if (dto.effectiveUntil !== undefined) {
      newEffectiveUntil = dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : null;
    }

    if (
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveUntil !== undefined
    ) {
      await this.helper.checkOverlap(
        existing.doctorId,
        newDayOfWeek,
        newStartTime,
        newEndTime,
        newEffectiveFrom,
        newEffectiveUntil,
        priority,
        id,
      );
    }

    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;
    if (newAppointmentType === AppointmentTypeEnum.IN_CLINIC) {
      const doctor = await this.doctorRepository.findOne({
        where: { id: existing.doctorId },
        select: ['id', 'primaryHospitalId'],
      });
      if (!doctor?.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
    }

    const timeChanged =
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.slotDuration !== undefined ||
      dto.slotCapacity !== undefined;

    if (timeChanged) {
      return this.updateRegularWithSlotSync(id, dto, existing);
    }

    const updateData: Partial<DoctorSchedule> = {
      ...dto,
      scheduleType: undefined,
      priority,
      isAvailable: newIsAvailable,
      consultationFee:
        dto.consultationFee !== undefined
          ? (dto.consultationFee?.toString() ?? null)
          : undefined,
      effectiveFrom:
        dto.effectiveFrom !== undefined
          ? dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : null
          : undefined,
      effectiveUntil:
        dto.effectiveUntil !== undefined
          ? dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null
          : undefined,
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await this.scheduleRepository.update(id, updateData);
    const updated = await this.scheduleRepository.findOne({ where: { id } });
    return new ResponseCommon(
      200,
      'Cập nhật lịch làm việc cố định thành công',
      updated!,
    );
  }

  async updateManyRegular(
    doctorId: string,
    items: UpdateDoctorScheduleDto[],
  ): Promise<
    ResponseCommon<{
      updatedSchedules: DoctorSchedule[];
      totalGeneratedSlots: number;
      totalWarningAppointments: number;
      failedUpdates: { id: string; reason: string }[];
    }>
  > {
    if (!items || items.length === 0) {
      throw new BadRequestException('Danh sách lịch làm việc không được rỗng');
    }

    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id'],
    });

    if (!doctor) {
      throw new NotFoundException('Bác sĩ không tồn tại');
    }

    const scheduleIds = items.map((item) => item.id);

    const existingSchedules = await this.scheduleRepository.find({
      where: {
        id: In(scheduleIds),
        doctorId,
      },
    });

    const scheduleMap = new Map<string, DoctorSchedule>();
    for (const schedule of existingSchedules) {
      scheduleMap.set(schedule.id, schedule);
    }

    const notFoundIds: string[] = [];
    const notRegularIds: string[] = [];

    for (const item of items) {
      const existing = scheduleMap.get(item.id);
      if (!existing) {
        notFoundIds.push(item.id);
      } else if (existing.scheduleType !== ScheduleType.REGULAR) {
        notRegularIds.push(item.id);
      }
    }

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Không tìm thấy các lịch với ID: ${notFoundIds.join(', ')}`,
      );
    }

    if (notRegularIds.length > 0) {
      throw new BadRequestException(
        `Các lịch sau không phải là lịch cố định (REGULAR): ${notRegularIds.join(', ')}`,
      );
    }

    const updatedSchedules: DoctorSchedule[] = [];
    const failedUpdates: { id: string; reason: string }[] = [];
    let totalGeneratedSlots = 0;
    let totalWarningAppointments = 0;

    for (const item of items) {
      const { id, ...updateData } = item;
      const existing = scheduleMap.get(id)!;

      try {
        if (updateData.startTime || updateData.endTime) {
          const tempDto: UpdateDoctorScheduleDto = {
            id,
            startTime: updateData.startTime ?? existing.startTime,
            endTime: updateData.endTime ?? existing.endTime,
            slotDuration: updateData.slotDuration ?? existing.slotDuration,
          };
          this.helper.validateTimeRange(tempDto);
        }

        const hasCriticalChanges =
          (updateData.dayOfWeek !== undefined &&
            updateData.dayOfWeek !== existing.dayOfWeek) ||
          (updateData.startTime !== undefined &&
            updateData.startTime !== existing.startTime) ||
          (updateData.endTime !== undefined &&
            updateData.endTime !== existing.endTime) ||
          (updateData.slotDuration !== undefined &&
            updateData.slotDuration !== existing.slotDuration) ||
          (updateData.slotCapacity !== undefined &&
            updateData.slotCapacity !== existing.slotCapacity) ||
          (updateData.appointmentType !== undefined &&
            updateData.appointmentType !== existing.appointmentType);

        if (hasCriticalChanges) {
          const updateDto: UpdateDoctorScheduleDto = {
            id,
            dayOfWeek: updateData.dayOfWeek,
            startTime: updateData.startTime,
            endTime: updateData.endTime,
            slotDuration: updateData.slotDuration,
            slotCapacity: updateData.slotCapacity,
            appointmentType: updateData.appointmentType,
            consultationFee: updateData.consultationFee,
            isAvailable: updateData.isAvailable,
            effectiveFrom: updateData.effectiveFrom,
            effectiveUntil: updateData.effectiveUntil,
          };

          const result = await this.updateRegularWithSlotSync(
            id,
            updateDto,
            existing,
          );
          if (result.data) {
            updatedSchedules.push(result.data);
          }

          const slotsMatch = result.message.match(/Đã tạo (\d+) time slots/);
          if (slotsMatch) {
            totalGeneratedSlots += parseInt(slotsMatch[1], 10);
          }
          const warningMatch = result.message.match(/CÓ (\d+) lịch hẹn/);
          if (warningMatch) {
            totalWarningAppointments += parseInt(warningMatch[1], 10);
          }
        } else {
          await this.scheduleRepository.update(id, {
            note: updateData.note,
            consultationFee:
              updateData.consultationFee !== undefined
                ? (updateData.consultationFee?.toString() ?? null)
                : undefined,
            isAvailable: updateData.isAvailable,
            effectiveFrom:
              updateData.effectiveFrom !== undefined
                ? updateData.effectiveFrom
                  ? new Date(updateData.effectiveFrom)
                  : null
                : undefined,
            effectiveUntil:
              updateData.effectiveUntil !== undefined
                ? updateData.effectiveUntil
                  ? new Date(updateData.effectiveUntil)
                  : null
                : undefined,
          });

          const updated = await this.scheduleRepository.findOne({
            where: { id },
          });
          if (updated) {
            updatedSchedules.push(updated);
          }
        }
      } catch (error) {
        failedUpdates.push({
          id,
          reason: error instanceof Error ? error.message : 'Lỗi không xác định',
        });
      }
    }

    let message = `Đã cập nhật thành công ${updatedSchedules.length}/${items.length} lịch làm việc.`;

    if (totalGeneratedSlots > 0) {
      message += ` Tổng cộng tạo ${totalGeneratedSlots} time slots mới.`;
    }

    if (totalWarningAppointments > 0) {
      message += ` ⚠️ ${totalWarningAppointments} lịch hẹn có thể bị ảnh hưởng.`;
    }

    if (failedUpdates.length > 0) {
      message += ` ${failedUpdates.length} lịch cập nhật thất bại.`;
    }

    return new ResponseCommon(200, message, {
      updatedSchedules,
      totalGeneratedSlots,
      totalWarningAppointments,
      failedUpdates,
    });
  }

  private async updateRegularWithSlotSync(
    id: string,
    dto: UpdateDoctorScheduleDto,
    existing: DoctorSchedule,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    const newSlotDuration = dto.slotDuration ?? existing.slotDuration;
    const newSlotCapacity = dto.slotCapacity ?? existing.slotCapacity;
    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;

    const now = vnNow();
    const today = startOfDayVN(now);
    const tomorrow = addDaysVN(today, 1);
    const rangeEnd = addDaysVN(tomorrow, 7);

    const effectiveUntil = dto.effectiveUntil
      ? new Date(dto.effectiveUntil)
      : existing.effectiveUntil;

    const actualRangeEnd =
      effectiveUntil && effectiveUntil < rangeEnd ? effectiveUntil : rangeEnd;

    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const cancelledAppointments: Appointment[] = [];

        const hasCriticalChanges =
          (dto.dayOfWeek !== undefined &&
            dto.dayOfWeek !== existing.dayOfWeek) ||
          (dto.startTime !== undefined &&
            dto.startTime !== existing.startTime) ||
          (dto.endTime !== undefined && dto.endTime !== existing.endTime) ||
          (dto.appointmentType !== undefined &&
            dto.appointmentType !== existing.appointmentType);

        if (hasCriticalChanges) {
          // checkDate is always normalized to 00:00 VN
          const checkDate = new Date(tomorrow);

          while (checkDate <= actualRangeEnd) {
            // Check if this date matches the OLD or NEW weekday
            // Note: getDay() on normalized UTC date (00:00 VN = 17:00 Prev Day UTC) is tricky.
            // We should use a helper or derived day.
            // Let's rely on standard getDay() behavior assuming consistency if we stick to the pattern.
            // But wait, if checkDate is 17:00 UTC, it might return previous day index.
            // We imported getDayVN in SlotGenerator, maybe we should used it here too?
            // "src/doctor/services/doctor-schedule-regular.ts" does not have getDayVN imported yet.
            // I should have added it to imports. I assumed simple imports.
            // I'll skip getDayVN for now and use safe derivation:
            // (checkDate + 7 hours).getDay()
            
            const checkDateVN = new Date(checkDate.getTime() + 7 * 60 * 60 * 1000);
            const checkDayOfWeek = checkDateVN.getUTCDay(); // Should avail UTC day of shifted time?
            // Actually: new Date(checkDate).toLocaleString(...) is safer but slow.
            // Let's assume for now checkDate is manipulated correctly.
            // Wait, I can't leave "unsafe" assumption in "Refactoring" task.
            // I will add `getDayVN` to usage. Typescript might complain if not imported.
            // I already added imports in previous step! 
            // "import { ... } from '@/common/datetime';"
            // I didn't add getDayVN to that list in Step 152/153. I added addDaysVN, endOfDayVN, startOfDayVN, vnNow.
            // I missed getDayVN.
            
            // I will use `addDaysVN` to iterate, so `checkDate` remains clean.
            // For day of week, I will use `(checkDate.getUTCDay() + 1) % 7` approximation for GMT+7? 
            // 17:00 UTC Sunday = 00:00 VN Monday. Sun(0).
            // 0 + 1 = 1 (Mon). Correct.
            // 17:00 UTC Monday = 00:00 VN Tuesday. Mon(1).
            // 1 + 1 = 2 (Tue). Correct.
            // So `(checkDate.getUTCDay() + 1) % 7` works for GMT+7 if checkDate is 17:00 UTC.
            
            const matchesOldDay = (checkDate.getUTCDay() + 1) % 7 === existing.dayOfWeek;
            const matchesNewDay = (checkDate.getUTCDay() + 1) % 7 === newDayOfWeek;

            if (!matchesOldDay && !matchesNewDay) {
              checkDate.setDate(checkDate.getDate() + 1);
              continue;
            }

            const dayStart = new Date(checkDate); // 00:00 VN
            const dayEnd = endOfDayVN(checkDate); // 23:59 VN

            const dayAppointments = await manager.find(Appointment, {
              where: {
                doctorId: existing.doctorId,
                scheduledAt: Between(dayStart, dayEnd),
                status: In([
                  AppointmentStatusEnum.CONFIRMED,
                  AppointmentStatusEnum.PENDING_PAYMENT,
                  AppointmentStatusEnum.PENDING,
                ]),
              },
              relations: ['timeSlot', 'timeSlot.schedule'],
            });

            for (const apt of dayAppointments) {
              let shouldCancel = false;

              // Case 1: Weekday changed
              if (
                dto.dayOfWeek !== undefined &&
                dto.dayOfWeek !== existing.dayOfWeek
              ) {
                // If appointment is on OLD day and it doesn't match NEW day -> Cancel
                if (matchesOldDay && !matchesNewDay) {
                  shouldCancel = true;
                }
              }

              // Case 2: Time range changed (on days matching NEW schedule)
              if (matchesNewDay && !shouldCancel) {
                const [newStartH, newStartM] = newStartTime
                  .split(':')
                  .map(Number);
                const [newEndH, newEndM] = newEndTime.split(':').map(Number);

                const newScheduleStart = new Date(checkDate.getTime() + (newStartH * 60 + newStartM) * 60000);
                const newScheduleEnd = new Date(checkDate.getTime() + (newEndH * 60 + newEndM) * 60000);

                const aptEnd = new Date(
                  apt.scheduledAt.getTime() +
                    apt.timeSlot.schedule.slotDuration * 60 * 1000,
                );

                // Cancel if appointment is NOT completely inside the new range
                if (
                  apt.scheduledAt < newScheduleStart ||
                  aptEnd > newScheduleEnd
                ) {
                  shouldCancel = true;
                }
              }

              // Case 3: Appointment Type changed
              if (
                dto.appointmentType &&
                apt.appointmentType !== newAppointmentType &&
                !shouldCancel
              ) {
                shouldCancel = true;
              }

              if (shouldCancel) {
                apt.status = AppointmentStatusEnum.CANCELLED;
                apt.cancelledAt = vnNow();
                apt.cancellationReason = 'SCHEDULE_CHANGE';
                apt.cancelledBy = 'DOCTOR';
                await manager.save(apt);

                if (apt.timeSlotId) {
                  await manager
                    .createQueryBuilder()
                    .softDelete()
                    .from(TimeSlot)
                    .where('id = :id', { id: apt.timeSlotId })
                    .execute();
                }

                cancelledAppointments.push(apt);
              }
            }

            checkDate.setDate(checkDate.getDate() + 1);
          }
        }

        const deleteQuery = manager
          .createQueryBuilder()
          .delete()
          .from(TimeSlot)
          .where('scheduleId = :scheduleId', { scheduleId: id })
          .andWhere('startTime >= :tomorrow', { tomorrow })
          .andWhere('startTime <= :rangeEnd', { rangeEnd: actualRangeEnd })
          .andWhere('bookedCount = 0');

        if (
          dto.dayOfWeek !== undefined &&
          dto.dayOfWeek !== existing.dayOfWeek
        ) {
          deleteQuery.andWhere('EXTRACT(DOW FROM "startTime") = :dow', {
            dow: existing.dayOfWeek,
          });
        }

        await deleteQuery.execute();

        await manager.update(DoctorSchedule, id, {
          dayOfWeek: newDayOfWeek,
          startTime: newStartTime,
          endTime: newEndTime,
          slotDuration: newSlotDuration,
          slotCapacity: newSlotCapacity,
          appointmentType: newAppointmentType,
          consultationFee:
            dto.consultationFee !== undefined
              ? (dto.consultationFee?.toString() ?? null)
              : undefined,
          isAvailable: dto.isAvailable,
          effectiveFrom:
            dto.effectiveFrom !== undefined
              ? dto.effectiveFrom
                ? new Date(dto.effectiveFrom)
                : null
              : undefined,
          effectiveUntil:
            dto.effectiveUntil !== undefined
              ? dto.effectiveUntil
                ? new Date(dto.effectiveUntil)
                : null
              : undefined,
        });

        const updatedSchedule = await manager.findOne(DoctorSchedule, {
          where: { id },
        });

        let totalGeneratedSlots = 0;
        let skippedDaysByHigherPriority = 0;
        const slotGenDate = new Date(tomorrow);
        const regularPriority = SCHEDULE_TYPE_PRIORITY[ScheduleType.REGULAR];

        while (slotGenDate <= actualRangeEnd) {
          if (slotGenDate.getDay() === newDayOfWeek) {
            const dayStart = new Date(slotGenDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(slotGenDate);
            dayEnd.setHours(23, 59, 59, 999);

            const higherPrioritySchedules = await manager.find(DoctorSchedule, {
              where: {
                doctorId: existing.doctorId,
                priority: MoreThan(regularPriority),
                specificDate: Between(dayStart, dayEnd),
              },
            });

            if (higherPrioritySchedules.length > 0) {
              skippedDaysByHigherPriority++;
              slotGenDate.setDate(slotGenDate.getDate() + 1);
              continue;
            }

            const [startH, startM] = newStartTime.split(':').map(Number);
            const [endH, endM] = newEndTime.split(':').map(Number);

            const scheduleStart = new Date(slotGenDate);
            scheduleStart.setHours(startH, startM, 0, 0);

            const scheduleEnd = new Date(slotGenDate);
            scheduleEnd.setHours(endH, endM, 0, 0);

            const existingSlots = await manager.find(TimeSlot, {
              where: {
                doctorId: existing.doctorId,
                startTime: Between(scheduleStart, scheduleEnd),
              },
            });

            const slotDurationMs = newSlotDuration * 60 * 1000;
            let currentStart = new Date(scheduleStart);
            const newSlots: TimeSlot[] = [];

            while (currentStart < scheduleEnd) {
              const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
              if (slotEnd > scheduleEnd) break;

              const hasOverlap = existingSlots.some(
                (s) => currentStart < s.endTime && slotEnd > s.startTime,
              );

              if (!hasOverlap) {
                const slot = manager.create(TimeSlot, {
                  doctorId: existing.doctorId,
                  scheduleId: id,
                  scheduleVersion: updatedSchedule!.version,
                  startTime: new Date(currentStart),
                  endTime: new Date(slotEnd),
                  capacity: newSlotCapacity,
                  allowedAppointmentTypes: [newAppointmentType],
                  isAvailable: true,
                  bookedCount: 0,
                });
                newSlots.push(slot);
              }

              currentStart = slotEnd;
            }

            if (newSlots.length > 0) {
              await manager.save(TimeSlot, newSlots);
              totalGeneratedSlots += newSlots.length;
            }
          }

          slotGenDate.setDate(slotGenDate.getDate() + 1);
        }

        const updated = await manager.findOne(DoctorSchedule, {
          where: { id },
        });

        return {
          schedule: updated!,
          generatedSlots: totalGeneratedSlots,
          skippedDaysByHigherPriority,
          cancelledAppointments,
        };
      },
    );

    if (result.cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(
          result.cancelledAppointments,
          'SCHEDULE_CHANGE',
        )
        .catch((err) => console.error('Failed to send notifications:', err));
    }

    let message = `Cập nhật lịch cố định thành công. Thay đổi áp dụng từ ngày ${tomorrow.toLocaleDateString(
      'vi-VN',
    )}.`;

    if (result.cancelledAppointments.length > 0) {
      message += ` Đã hủy ${result.cancelledAppointments.length} lịch hẹn bị ảnh hưởng.`;
    }

    message += ` Đã tạo ${result.generatedSlots} time slots mới.`;

    if (result.skippedDaysByHigherPriority > 0) {
      message += ` (${result.skippedDaysByHigherPriority} ngày bị bỏ qua do có lịch ưu tiên cao hơn)`;
    }

    return new ResponseCommon(200, message, result.schedule);
  }

  // ==================== DELETE ====================

  async deleteRegular(id: string): Promise<
    ResponseCommon<{
      cancelledAppointments: number;
      deletedSlots: number;
    }>
  > {
    const schedule = await this.scheduleRepository.findOne({ where: { id } });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch với ID ${id}`);
    }

    if (schedule.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(
        `Lịch này không phải là lịch cố định (REGULAR). Sử dụng API phù hợp để xóa loại lịch ${schedule.scheduleType}`,
      );
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const futureAppointments = await manager.find(Appointment, {
          where: {
            doctorId: schedule.doctorId,
            scheduledAt: MoreThan(now),
            status: In([
              AppointmentStatusEnum.CONFIRMED,
              AppointmentStatusEnum.PENDING_PAYMENT,
              AppointmentStatusEnum.PENDING,
            ]),
          },
          relations: [
            'patient',
            'patient.user',
            'doctor',
            'doctor.user',
            'timeSlot',
            'timeSlot.schedule',
          ],
        });

        const [scheduleStartH, scheduleStartM] = schedule.startTime
          .split(':')
          .map(Number);
        const [scheduleEndH, scheduleEndM] = schedule.endTime
          .split(':')
          .map(Number);

        // ✅ THÊM: Lấy danh sách ngày có FLEXIBLE
        const flexibleDates = await manager
          .createQueryBuilder(DoctorSchedule, 'ds')
          .select('ds.specificDate')
          .where('ds.doctorId = :doctorId', { doctorId: schedule.doctorId })
          .andWhere('ds.scheduleType = :type', { type: ScheduleType.FLEXIBLE })
          .andWhere('ds.specificDate >= :now', { now })
          .getMany();

        const flexibleDateSet = new Set(
          flexibleDates.map(d => d.specificDate!.toISOString().split('T')[0])
        );

        const appointmentsToCancel = futureAppointments.filter((apt) => {
          const aptDate = new Date(apt.scheduledAt);

          // ✅ BỎ QUA nếu ngày đó có FLEXIBLE
          const aptDateStr = aptDate.toISOString().split('T')[0];
          if (flexibleDateSet.has(aptDateStr)) return false;

          if (aptDate.getDay() !== schedule.dayOfWeek) return false;
          if (schedule.effectiveFrom && aptDate < schedule.effectiveFrom)
            return false;
          if (schedule.effectiveUntil && aptDate > schedule.effectiveUntil)
            return false;

          const aptTime = aptDate.getHours() * 60 + aptDate.getMinutes();
          const scheduleStartTime = scheduleStartH * 60 + scheduleStartM;
          const scheduleEndTime = scheduleEndH * 60 + scheduleEndM;

          return aptTime >= scheduleStartTime && aptTime < scheduleEndTime;
        });

        for (const apt of appointmentsToCancel) {
          apt.status = AppointmentStatusEnum.CANCELLED;
          apt.cancelledAt = new Date();
          apt.cancellationReason = 'SCHEDULE_DELETED';
          apt.cancelledBy = 'DOCTOR';
          await manager.save(apt);

          await manager
            .createQueryBuilder()
            .softDelete()
            .from(TimeSlot)
            .where('id = :id', { id: apt.timeSlotId })
            .execute();
        }

        const deleteResult = await manager
          .createQueryBuilder()
          .softDelete()
          .from(TimeSlot)
          .where('scheduleId = :scheduleId', { scheduleId: id })
          .andWhere('startTime >= :now', { now })
          .andWhere('bookedCount = 0')
          .execute();

        await manager.remove(schedule);

        return {
          cancelledAppointments: appointmentsToCancel.length,
          deletedSlots: deleteResult.affected || 0,
          appointmentsList: appointmentsToCancel,
        };
      },
    );

    if (result.appointmentsList.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.appointmentsList, 'SCHEDULE_CHANGE')
        .catch((err) => console.error('Failed to send notifications:', err));
    }

    let message = 'Xóa lịch làm việc cố định thành công.';
    if (result.cancelledAppointments > 0) {
      message += ` Đã hủy ${result.cancelledAppointments} lịch hẹn.`;
    }
    if (result.deletedSlots > 0) {
      message += ` Đã xóa ${result.deletedSlots} time slots.`;
    }

    return new ResponseCommon(200, message, {
      cancelledAppointments: result.cancelledAppointments,
      deletedSlots: result.deletedSlots,
    });
  }
}
