export function validateMessage(msg: any) {
  if (msg.length > 1024) throw new Error('Size limit exceeded');
}
