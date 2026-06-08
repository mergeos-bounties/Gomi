import type { GomiChatMessage } from '../common/gomiTypes';

export function appendGomiChatMessage(
  messages: GomiChatMessage[],
  message: GomiChatMessage,
  limit = 200
): GomiChatMessage[] {
  return [...messages, message].slice(-limit);
}
