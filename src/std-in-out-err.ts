import { Stream } from "stream";

interface StdInOutErrProps {
  stdin: Stream;
  stdout: Stream;
  stderr: Stream;
}

class StdInOutErr {
  private stdin: Stream;
  private stdout: Stream;

  private stder: Stream;

  constructor(props: StdInOutErrProps) {
    const { stdin, stdout, stderr } = props;
  }
}
