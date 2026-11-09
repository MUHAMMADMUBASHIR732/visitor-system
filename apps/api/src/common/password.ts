/** At least 8 characters with a letter and a number. */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;
export const PASSWORD_MESSAGE = 'Use at least 8 characters with a letter and a number.';
