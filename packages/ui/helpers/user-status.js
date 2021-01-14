const DEACTIVATED = `deactivated`;
const CONFIRMED = `confirmed`;
const PASSWORD_MAIL_SENT = `password-mail-sent`;
const TO_BE_INITIALIZED = `to-be-initialized`;

const statusIcons = {
  [DEACTIVATED]: `airline_seat_individual_suite`,
  [CONFIRMED]: `check`,
  [PASSWORD_MAIL_SENT]: `schedule`,
  [TO_BE_INITIALIZED]: `report_problem`,
};

export const getStatusIcon = (statusName) => statusIcons[statusName];

export const getStatusActions = (statusName) => {
  return {
    activate: statusName === DEACTIVATED,
    resetPassword: statusName === CONFIRMED,
    sendPassword: statusName === TO_BE_INITIALIZED,
    reSendPassword: statusName === PASSWORD_MAIL_SENT,
  };
};
