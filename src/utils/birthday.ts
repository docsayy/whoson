export type BirthdayFields = {
  birthdayMonth?: number;
  birthdayDay?: number;
};

export function validBirthday(month?: number, day?: number) {
  if (!month || !day) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const test = new Date(2024, month - 1, day);
  return test.getMonth() === month - 1 && test.getDate() === day;
}

export function isBirthdayOnDate(
  person: BirthdayFields | null | undefined,
  dateValue: string | Date
) {
  if (!person || !validBirthday(person.birthdayMonth, person.birthdayDay)) {
    return false;
  }

  const date =
    typeof dateValue === "string"
      ? new Date(`${dateValue}T12:00:00`)
      : dateValue;

  return (
    date.getMonth() + 1 === person.birthdayMonth &&
    date.getDate() === person.birthdayDay
  );
}

export function formatBirthday(person: BirthdayFields | null | undefined) {
  if (!person || !validBirthday(person.birthdayMonth, person.birthdayDay)) {
    return "Not provided";
  }

  return new Date(2024, person.birthdayMonth! - 1, person.birthdayDay!).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" }
  );
}

export function birthdayName(name: string, birthday: boolean) {
  return birthday && name ? `🎂 ${name}` : name;
}
