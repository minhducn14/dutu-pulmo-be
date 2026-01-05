import { Test, TestingModule } from '@nestjs/testing';
import { SlotGeneratorService } from './slot-generator.service';
import { DoctorScheduleService } from './doctor-schedule.service';
import { TimeSlotService } from './time-slot.service';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { ScheduleType } from 'src/modules/common/enums/schedule-type.enum';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { TimeSlot } from './entities/time-slot.entity';

describe('SlotGeneratorService', () => {
  let service: SlotGeneratorService;
  let mockScheduleService: Partial<DoctorScheduleService>;
  let mockTimeSlotService: Partial<TimeSlotService>;

  const mockDoctorId = 'doctor-123';

  // Helper to create a mock schedule
  const createMockSchedule = (
    overrides: Partial<DoctorSchedule> = {},
  ): DoctorSchedule => ({
    id: 'schedule-' + Math.random().toString(36).substr(2, 9),
    doctorId: mockDoctorId,
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 30,
    slotCapacity: 1,
    scheduleType: ScheduleType.REGULAR,
    priority: 0,
    isAvailable: true,
    appointmentType: AppointmentTypeEnum.IN_CLINIC,
    hospitalId: 'hospital-123',
    minimumBookingTime: 60,
    maxAdvanceBookingDays: 30,
    note: null,
    consultationFee: null,
    description: null,
    effectiveFrom: null,
    effectiveUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    doctor: null as any,
    ...overrides,
  });

  beforeEach(async () => {
    mockScheduleService = {
      findById: jest.fn(),
      findByDoctorId: jest.fn(),
    };

    mockTimeSlotService = {
      findAvailableSlots: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockImplementation((doctorId, dtos) => ({
        data: dtos.map((dto: any, i: number) => ({ id: `slot-${i}`, ...dto })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotGeneratorService,
        { provide: DoctorScheduleService, useValue: mockScheduleService },
        { provide: TimeSlotService, useValue: mockTimeSlotService },
      ],
    }).compile();

    service = module.get<SlotGeneratorService>(SlotGeneratorService);
  });

  describe('generateSlotsForDay - Priority Logic', () => {
    /**
     * Test Case 1: BLOCK_OUT takes precedence over everything
     */
    it('should return NO slots when BLOCK_OUT schedule exists (skips entire day)', () => {
      const targetDate = new Date('2026-01-12'); // Monday

      const schedules: DoctorSchedule[] = [
        createMockSchedule({
          scheduleType: ScheduleType.BLOCK_OUT,
          priority: 200,
          startTime: '08:00', // Time doesn't matter for whole-day block logic
          endTime: '12:00',
        }),
        createMockSchedule({
          scheduleType: ScheduleType.HOLIDAY,
          priority: 100,
          startTime: '09:00',
          endTime: '17:00',
          slotDuration: 30,
        }),
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          startTime: '08:00',
          endTime: '20:00',
          slotDuration: 30,
        }),
      ];

      const sortedSchedules = schedules.sort((a, b) => b.priority - a.priority);
      const slots = (service as any).generateSlotsForDay(targetDate, sortedSchedules);

      expect(slots.length).toBe(0);
    });

    /**
     * Test Case 2: HOLIDAY precedence
     * Logic: If HOLIDAY exists, use HOLIDAY schedules ONLY. Ignore REGULAR schedules.
     */
    it('should generate slots ONLY from HOLIDAY schedules when they exist, ignoring REGULAR schedules', () => {
      const targetDate = new Date('2026-01-12'); // Monday

      const schedules: DoctorSchedule[] = [
        createMockSchedule({
          scheduleType: ScheduleType.HOLIDAY,
          priority: 100,
          startTime: '09:00',
          endTime: '12:00',
          slotDuration: 30,
          isAvailable: true,
        }),
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          startTime: '13:00',
          endTime: '17:00',
          slotDuration: 30,
        }),
      ];

      const sortedSchedules = schedules.sort((a, b) => b.priority - a.priority);
      const slots = (service as any).generateSlotsForDay(targetDate, sortedSchedules);

      // Should ONLY have slots from HOLIDAY (09:00-12:00)
      // REGULAR (13:00-17:00) should be completely ignored
      expect(slots.length).toBeGreaterThan(0);
      
      slots.forEach((slot: Partial<TimeSlot>) => {
        const startHour = slot.startTime!.getHours();
        expect(startHour).toBeGreaterThanOrEqual(9);
        expect(startHour).toBeLessThan(12);
      });

      // Verification: No afternoon slots
      const afternoonSlots = slots.filter((s: Partial<TimeSlot>) => s.startTime!.getHours() >= 13);
      expect(afternoonSlots.length).toBe(0);
    });

    /**
     * Test Case 3: Multiple HOLIDAY schedules
     */
    it('should generate slots from ALL active HOLIDAY schedules if multiple exist', () => {
      const targetDate = new Date('2026-01-12'); // Monday

      const schedules: DoctorSchedule[] = [
        createMockSchedule({
          scheduleType: ScheduleType.HOLIDAY,
          priority: 100,
          startTime: '09:00',
          endTime: '10:00',
          slotDuration: 30,
          isAvailable: true,
        }),
        createMockSchedule({
          scheduleType: ScheduleType.HOLIDAY,
          priority: 100,
          startTime: '14:00',
          endTime: '15:00',
          slotDuration: 30,
          isAvailable: true,
        }),
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          startTime: '08:00',
          endTime: '18:00',
          slotDuration: 30,
        }),
      ];

      const sortedSchedules = schedules.sort((a, b) => b.priority - a.priority);
      const slots = (service as any).generateSlotsForDay(targetDate, sortedSchedules);

      // Should have slots from both HOLIDAYs (4 slots total)
      // Regular schedule is ignored
      expect(slots.length).toBe(4); 
      
      const morning = slots.filter((s: Partial<TimeSlot>) => s.startTime!.getHours() === 9);
      const afternoon = slots.filter((s: Partial<TimeSlot>) => s.startTime!.getHours() === 14);

      expect(morning.length).toBe(2);
      expect(afternoon.length).toBe(2);
    });

    /**
     * Test Case 4: Normal REGULAR flow
     */
    it('should generate slots from REGULAR schedules when NO Holiday/BlockOut exist', () => {
      const targetDate = new Date('2026-01-12'); // Monday

      const schedules: DoctorSchedule[] = [
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          startTime: '09:00',
          endTime: '11:00',
          slotDuration: 30,
          isAvailable: true,
        }),
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          startTime: '14:00',
          endTime: '15:00',
          slotDuration: 30,
          isAvailable: true,
        }),
      ];

      const sortedSchedules = schedules.sort((a, b) => b.priority - a.priority);
      const slots = (service as any).generateSlotsForDay(targetDate, sortedSchedules);

      expect(slots.length).toBe(6); // 4 + 2 slots
    });
  });

  describe('isAvailable and Validity Checks', () => {
    /**
     * Test Case 5: HOLIDAY with isAvailable=false
     */
    it('should ignore HOLIDAY schedules if isAvailable=false, falling back to REGULAR?', () => {
      // NOTE: Current logic: holidays = filter(s => type==HOLIDAY && s.isAvailable)
      // If holiday has isAvailable=false, it is filtered OUT of `holidays` array.
      // If `holidays` array is empty, code proceeds to `else` block (Regular schedules).
      
      const targetDate = new Date('2026-01-12'); // Monday

      const schedules: DoctorSchedule[] = [
        createMockSchedule({
          scheduleType: ScheduleType.HOLIDAY,
          priority: 100,
          startTime: '09:00',
          endTime: '12:00',
          isAvailable: false, // Inactive holiday
        }),
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          startTime: '09:00',
          endTime: '17:00',
          slotDuration: 60,
          isAvailable: true,
        }),
      ];

      const sortedSchedules = schedules.sort((a, b) => b.priority - a.priority);
      const slots = (service as any).generateSlotsForDay(targetDate, sortedSchedules);

      // Since holiday is unavailable, it is ignored basically.
      // Code falls through to REGULAR schedule.
      expect(slots.length).toBe(8); // 09:00 to 17:00 (8 hours)
    });

    /**
     * Test Case 6: REGULAR with isAvailable=false
     */
    it('should not generate slots for REGULAR schedules with isAvailable=false', () => {
      const targetDate = new Date('2026-01-12'); // Monday

      const schedules: DoctorSchedule[] = [
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: false,
        }),
      ];

      const sortedSchedules = schedules.sort((a, b) => b.priority - a.priority);
      const slots = (service as any).generateSlotsForDay(targetDate, sortedSchedules);

      expect(slots.length).toBe(0);
    });

    /**
     * Test Case 7: effectiveFrom / effectiveUntil
     */
    it('should respect effectiveFrom and effectiveUntil dates', () => {
      const targetDate = new Date('2026-01-15'); // Thursday

      const schedules: DoctorSchedule[] = [
        // Not yet active
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          effectiveFrom: new Date('2026-02-01'),
          startTime: '09:00', endTime: '12:00',
          isAvailable: true,
          dayOfWeek: 4,
        }),
        // Expired
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          effectiveUntil: new Date('2026-01-01'),
          startTime: '13:00', endTime: '17:00',
          isAvailable: true,
          dayOfWeek: 4,
        }),
        // Active
        createMockSchedule({
          scheduleType: ScheduleType.REGULAR,
          effectiveFrom: new Date('2026-01-01'),
          effectiveUntil: new Date('2026-02-01'),
          startTime: '18:00', endTime: '19:00',
          slotDuration: 60,
          isAvailable: true,
          dayOfWeek: 4,
        }),
      ];

      const sortedSchedules = schedules.sort((a, b) => b.priority - a.priority);
      const slots = (service as any).generateSlotsForDay(targetDate, sortedSchedules);

      // Only the active one (18:00-19:00) should generate slots
      expect(slots.length).toBe(1);
      expect(slots[0].startTime!.getHours()).toBe(18);
    });
  });

  describe('Slot Generation Details', () => {
    it('should generate correct number of slots based on duration', () => {
      const schedule = createMockSchedule({
        startTime: '09:00',
        endTime: '11:00', // 120 minutes
        slotDuration: 30, // 30 mins -> 4 slots
      });
      const targetDate = new Date('2026-01-12');

      const slots = service.generateSlotsFromSchedule(schedule, targetDate);

      expect(slots.length).toBe(4);
      expect(slots[0].startTime!.getHours()).toBe(9);
      expect(slots[0].startTime!.getMinutes()).toBe(0);
      expect(slots[3].startTime!.getHours()).toBe(10);
      expect(slots[3].startTime!.getMinutes()).toBe(30);
    });

    it('should throw exception for invalid slot duration', () => {
      const schedule = createMockSchedule({ slotDuration: 0 });
      const targetDate = new Date();
      expect(() => service.generateSlotsFromSchedule(schedule, targetDate)).toThrow();
    });
  });

  describe('Integration: generateAndSaveSlots', () => {
    it('should explicitly filter out overlapping existing slots', async () => {
      const startDate = new Date('2026-01-12');
      const endDate = new Date('2026-01-12');
      const scheduleId = 'template-1';

      // Mock Schedule: 09:00-10:00 (30m slots -> 09:00, 09:30)
      const mockSchedule = createMockSchedule({
        startTime: '09:00', endTime: '10:00', slotDuration: 30
      });

      (mockScheduleService.findById as jest.Mock).mockResolvedValue({ data: mockSchedule });
      (mockScheduleService.findByDoctorId as jest.Mock).mockResolvedValue({ data: [mockSchedule] });
      
      // Mock Exists: 09:00-09:30 already exists
      (mockTimeSlotService.findAvailableSlots as jest.Mock).mockResolvedValue([
        {
          startTime: new Date('2026-01-12T09:00:00'),
          endTime: new Date('2026-01-12T09:30:00'),
        }
      ]);

      await service.generateAndSaveSlots(scheduleId, startDate, endDate);

      expect(mockTimeSlotService.createMany).toHaveBeenCalled();
      const callArgs = (mockTimeSlotService.createMany as jest.Mock).mock.calls[0];
      const dtos = callArgs[1];

      // Should only create 09:30-10:00 (1 slot)
      // 09:00-09:30 should be filtered out
      expect(dtos.length).toBe(1);
      const createdTime = new Date(dtos[0].startTime);
      expect(createdTime.getHours()).toBe(9);
      expect(createdTime.getMinutes()).toBe(30);
    });

    it('should handle multi-day generation correctly', async () => {
      const startDate = new Date('2026-01-12'); // Monday
      const endDate = new Date('2026-01-13'); // Tuesday

      const mockScheduleMonday = createMockSchedule({ dayOfWeek: 1, startTime: '09:00', endTime: '10:00', slotDuration: 60 });
      const mockScheduleTuesday = createMockSchedule({ dayOfWeek: 2, startTime: '09:00', endTime: '10:00', slotDuration: 60 });

      (mockScheduleService.findById as jest.Mock).mockResolvedValue({ data: mockScheduleMonday });
      (mockScheduleService.findByDoctorId as jest.Mock).mockResolvedValue({ 
        data: [mockScheduleMonday, mockScheduleTuesday] 
      });
      (mockTimeSlotService.findAvailableSlots as jest.Mock).mockResolvedValue([]);

      await service.generateAndSaveSlots('any', startDate, endDate);

      const callArgs = (mockTimeSlotService.createMany as jest.Mock).mock.calls[0];
      const dtos = callArgs[1];

      // Should generate 1 slot for Monday and 1 slot for Tuesday -> Total 2
      expect(dtos.length).toBe(2);
    });
  });
});
