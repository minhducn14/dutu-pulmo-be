import { BadRequestException } from '@nestjs/common';

const HTML_TAG_REGEX = /<[^>]+>/;
const BASE64_IMAGE_REGEX = /data:image\//i;

export type TextFieldPolicyInput = {
  chiefComplaint?: string | null;
  textFields?: Array<string | null | undefined>;
  base64ErrorCode?: string;
  chiefComplaintErrorCode: string;
};

export function validateTextFieldsPolicy(input: TextFieldPolicyInput): void {
  const chiefComplaint = input.chiefComplaint?.trim();
  if (
    chiefComplaint &&
    (HTML_TAG_REGEX.test(chiefComplaint) || BASE64_IMAGE_REGEX.test(chiefComplaint))
  ) {
    throw new BadRequestException(input.chiefComplaintErrorCode);
  }

  if (!input.base64ErrorCode) return;

  for (const value of input.textFields ?? []) {
    if (value && BASE64_IMAGE_REGEX.test(value)) {
      throw new BadRequestException(input.base64ErrorCode);
    }
  }
}
