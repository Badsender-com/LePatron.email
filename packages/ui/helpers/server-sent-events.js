export const EVENT_START = 'START';
export const EVENT_UPDATE = 'UPDATE';
export const EVENT_END = 'END';
export const EVENT_ERROR = 'ERROR';

export function getEventStatus(sseResponse) {
  const { type } = sseResponse;
  return {
    isStart: type === EVENT_START,
    isUpdate: type === EVENT_UPDATE,
    isEnd: type === EVENT_END,
    isError: type === EVENT_ERROR,
  };
}
