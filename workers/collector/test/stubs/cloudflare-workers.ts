export class DurableObject<E = unknown> {
  constructor(
    readonly ctx: unknown,
    readonly env: E,
  ) {}
}
