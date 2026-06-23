declare module 'csv-write-stream' {
  import { Writable } from 'stream';
  interface Options {
    headers?: string[];
    sendHeaders?: boolean;
    separator?: string;
    escape?: string;
    quoted?: boolean;
  }
  function csvWriteStream(opts?: Options): Writable;
  export = csvWriteStream;
}
