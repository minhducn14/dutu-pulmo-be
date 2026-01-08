import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsValidBookingWindow(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidBookingWindow',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const minDays = obj.minimumBookingDays ?? 0;
          const maxDays = obj.maxAdvanceBookingDays ?? 30;

          // Constraint: minimum must be < maximum
          return minDays < maxDays;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          const minDays = obj.minimumBookingDays ?? 0;
          const maxDays = obj.maxAdvanceBookingDays ?? 30;

          return `minimumBookingDays (${minDays} ngày) phải nhỏ hơn maxAdvanceBookingDays (${maxDays} ngày). Không có khoảng thời gian nào hợp lệ để đặt lịch.`;
        },
      },
    });
  };
}
