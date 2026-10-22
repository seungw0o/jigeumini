// `next build`가 테스트 파일까지 타입 검사해서 bun:test 최소 타입을 둔다. @types/bun을 설치하면 이 파일은 지운다.
declare module "bun:test" {
  type TestFn = () => void | Promise<unknown>;

  interface Matchers {
    not: Matchers;
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toMatchObject(expected: object): void;
    toHaveLength(length: number): void;
    toBeNull(): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toContain(expected: unknown): void;
  }

  interface AsyncMatchers {
    toMatchObject(expected: object): Promise<void>;
    toThrow(expected?: unknown): Promise<void>;
  }

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: TestFn): void;
  export function beforeEach(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;
  export function expect(actual: unknown): Matchers & { rejects: AsyncMatchers };
}
