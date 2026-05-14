import type { CreateMessageFormData, RepeatUnit } from './types';

type RepeatSubmissionFields = Pick<
  CreateMessageFormData,
  'Repeat_Every' | 'Repeat_Unit' | 'Repeat_Count' | 'Repeat_Days' | 'End_Date'
>;

export interface RepeatSubmissionInput {
  isRepeating: boolean;
  repeatEvery?: number;
  repeatUnit?: RepeatUnit;
  repeatCount?: number;
  selectedWeekDays?: number[];
  endDate?: string;
}

export function buildRepeatSubmissionFields(input: RepeatSubmissionInput): RepeatSubmissionFields {
  if (!input.isRepeating) {
    return {
      Repeat_Every: undefined,
      Repeat_Unit: undefined,
      Repeat_Count: undefined,
      Repeat_Days: undefined,
      End_Date: undefined,
    };
  }

  return {
    Repeat_Every: input.repeatEvery,
    Repeat_Unit: input.repeatUnit,
    Repeat_Count: input.repeatCount,
    Repeat_Days: input.repeatUnit === 'Week' && input.selectedWeekDays?.length
      ? input.selectedWeekDays.join(',')
      : undefined,
    End_Date: input.endDate,
  };
}
