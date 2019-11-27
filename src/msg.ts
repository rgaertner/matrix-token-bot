interface Msg<P, T extends string> {
  readonly type: T;
  readonly payload: P;
}
