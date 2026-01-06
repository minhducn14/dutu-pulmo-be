export enum ScheduleType {
  REGULAR = 'REGULAR', // Lịch thường ngày (priority 0)
  TEMPORARY = 'TEMPORARY', // Lịch tạm thời, đột xuất (priority 50)
  HOLIDAY = 'HOLIDAY', // Lịch ngày lễ - giờ giảm (priority 100)
  BLOCK_OUT = 'BLOCK_OUT', // Nghỉ hoàn toàn cả ngày (priority 200)
  EMERGENCY = 'EMERGENCY', // Khẩn cấp (priority 300)
}

export const SCHEDULE_TYPE_PRIORITY: Record<ScheduleType, number> = {
  [ScheduleType.REGULAR]: 0,
  [ScheduleType.TEMPORARY]: 50,
  [ScheduleType.HOLIDAY]: 100,
  [ScheduleType.BLOCK_OUT]: 200,
  [ScheduleType.EMERGENCY]: 300,
};
