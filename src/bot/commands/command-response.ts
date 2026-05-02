import type { Context } from 'grammy';

export type ReplyOptions = NonNullable<Parameters<Context['reply']>[1]>;

export type CommandResponse = {
  text: string;
  replyOptions?: ReplyOptions;
};

export function toCommandResponse(text: string, replyOptions?: ReplyOptions): CommandResponse {
  if (replyOptions === undefined) {
    return { text };
  }

  return { text, replyOptions };
}
