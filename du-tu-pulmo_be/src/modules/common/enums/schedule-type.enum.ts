export enum ScheduleType {
  REGULAR = 'REGULAR', // Lịch cố định - lặp lại theo tuần (priority 0)
  FLEXIBLE = 'FLEXIBLE', // Lịch làm việc linh hoạt - ngày cụ thể (priority 50)
  TIME_OFF = 'TIME_OFF', // Lịch nghỉ - block khung giờ cụ thể của ngày cụ thể (priority 100)
}

export const SCHEDULE_TYPE_PRIORITY: Record<ScheduleType, number> = {
  [ScheduleType.REGULAR]: 0,
  [ScheduleType.FLEXIBLE]: 50,
  [ScheduleType.TIME_OFF]: 100,
};
