export type PreviewFileKey = 'ts' | 'py' | 'go' | 'rs' | 'java' | 'bash'

export type PreviewSegmentRole =
  | 'comment'
  | 'decorator'
  | 'keyword'
  | 'operator'
  | 'namespace'
  | 'type'
  | 'function'
  | 'method'
  | 'function.defaultLibrary'
  | 'method.defaultLibrary'
  | 'variable'
  | 'variable.readonly'
  | 'parameter'
  | 'property'
  | 'string'
  | 'number'
  | 'plain'

export type PreviewSegment = {
  text: string
  role?: PreviewSegmentRole
}

export type PreviewSampleFile = {
  activeLine: number
  lines: PreviewSegment[][]
}

function seg(text: string, role?: PreviewSegmentRole): PreviewSegment {
  return role ? { text, role } : { text }
}

function line(...segments: PreviewSegment[]): PreviewSegment[] {
  return segments
}

export const previewSampleFiles: Record<PreviewFileKey, PreviewSampleFile> = {
  ts: {
    activeLine: 9,
    lines: [
      line(seg('// async data fetching with full type safety', 'comment')),
      line(
        seg('import ', 'keyword'),
        seg('{ '),
        seg('createContext', 'function.defaultLibrary'),
        seg(', '),
        seg('useContext', 'function.defaultLibrary'),
        seg(' } '),
        seg('from ', 'keyword'),
        seg("'react'", 'string'),
      ),
      line(),
      line(
        seg('interface ', 'keyword'),
        seg('ApiResponse', 'type'),
        seg('<'),
        seg('T', 'type'),
        seg('> {'),
      ),
      line(seg('  '), seg('data', 'property'), seg(': '), seg('T', 'type')),
      line(seg('  '), seg('status', 'property'), seg(': '), seg('number', 'type')),
      line(seg('  '), seg('ok', 'property'), seg(': '), seg('boolean', 'type')),
      line(seg('}')),
      line(),
      line(
        seg('async ', 'keyword'),
        seg('function ', 'keyword'),
        seg('request', 'function'),
        seg('<'),
        seg('T', 'type'),
        seg('>('),
      ),
      line(seg('  '), seg('url', 'parameter'), seg(': '), seg('string', 'type'), seg(',')),
      line(seg('  '), seg('options', 'parameter'), seg('?: '), seg('RequestInit', 'type')),
      line(
        seg('): '),
        seg('Promise', 'type'),
        seg('<'),
        seg('ApiResponse', 'type'),
        seg('<'),
        seg('T', 'type'),
        seg('>> {'),
      ),
      line(
        seg('  const ', 'keyword'),
        seg('res', 'variable'),
        seg(' = ', 'operator'),
        seg('await ', 'keyword'),
        seg('fetch', 'function.defaultLibrary'),
        seg('('),
        seg('url', 'parameter'),
        seg(', '),
        seg('options', 'parameter'),
        seg(')'),
      ),
      line(
        seg('  const ', 'keyword'),
        seg('data', 'variable'),
        seg(' = ', 'operator'),
        seg('await ', 'keyword'),
        seg('res', 'variable'),
        seg('.'),
        seg('json', 'method.defaultLibrary'),
        seg('() '),
        seg('as ', 'keyword'),
        seg('T', 'type'),
      ),
      line(
        seg('  return ', 'keyword'),
        seg('{ '),
        seg('data', 'property'),
        seg(', '),
        seg('status', 'property'),
        seg(': '),
        seg('res', 'variable'),
        seg('.'),
        seg('status', 'property'),
        seg(', '),
        seg('ok', 'property'),
        seg(': '),
        seg('res', 'variable'),
        seg('.'),
        seg('ok', 'property'),
        seg(' }'),
      ),
      line(seg('}')),
      line(),
      line(
        seg('const ', 'keyword'),
        seg('BASE', 'variable.readonly'),
        seg(' = ', 'operator'),
        seg("'https://api.vesper.dev'", 'string'),
      ),
      line(seg('const ', 'keyword'), seg('TIMEOUT', 'variable.readonly'), seg(' = ', 'operator'), seg('5_000', 'number')),
    ],
  },
  py: {
    activeLine: 18,
    lines: [
      line(seg('# dataclass-based connection pool', 'comment')),
      line(seg('from ', 'keyword'), seg('dataclasses', 'namespace'), seg(' import ', 'keyword'), seg('dataclass', 'decorator'), seg(', '), seg('field', 'function.defaultLibrary')),
      line(seg('from ', 'keyword'), seg('typing', 'namespace'), seg(' import ', 'keyword'), seg('Optional', 'type'), seg(', '), seg('ClassVar', 'type')),
      line(seg('import ', 'keyword'), seg('asyncio', 'namespace')),
      line(),
      line(seg('@dataclass', 'decorator')),
      line(seg('class ', 'keyword'), seg('Connection', 'type'), seg(':')),
      line(seg('    '), seg('host', 'property'), seg(': '), seg('str', 'type')),
      line(seg('    '), seg('port', 'property'), seg(': '), seg('int', 'type'), seg(' = '), seg('5432', 'number')),
      line(seg('    '), seg('timeout', 'property'), seg(': '), seg('float', 'type'), seg(' = '), seg('30.0', 'number')),
      line(),
      line(seg('class ', 'keyword'), seg('Pool', 'type'), seg(':')),
      line(seg('    '), seg('MAX', 'variable.readonly'), seg(': '), seg('ClassVar', 'type'), seg('['), seg('int', 'type'), seg('] = '), seg('20', 'number')),
      line(),
      line(seg('    def ', 'keyword'), seg('__init__', 'method'), seg('('), seg('self', 'parameter'), seg(', '), seg('dsn', 'parameter'), seg(': '), seg('str', 'type'), seg('):')),
      line(seg('        self'), seg('.'), seg('dsn', 'property'), seg(' = '), seg('dsn', 'parameter')),
      line(seg('        self'), seg('.'), seg('_pool', 'property'), seg(': '), seg('list', 'type'), seg('['), seg('Connection', 'type'), seg('] = []')),
      line(),
      line(seg('    async ', 'keyword'), seg('def ', 'keyword'), seg('acquire', 'method'), seg('('), seg('self', 'parameter'), seg(') -> '), seg('Optional', 'type'), seg('['), seg('Connection', 'type'), seg(']:'),),
      line(seg('        if ', 'keyword'), seg('not ', 'keyword'), seg('self'), seg('.'), seg('_pool', 'property'), seg(':')),
      line(seg('            return ', 'keyword'), seg('None', 'number')),
      line(seg('        return ', 'keyword'), seg('self'), seg('.'), seg('_pool', 'property'), seg('.'), seg('pop', 'method.defaultLibrary'), seg('()')),
    ],
  },
  go: {
    activeLine: 15,
    lines: [
      line(seg('// HTTP server with graceful shutdown', 'comment')),
      line(seg('package ', 'keyword'), seg('main', 'namespace')),
      line(),
      line(seg('import ', 'keyword'), seg('(')),
      line(seg('  '), seg('"context"', 'string')),
      line(seg('  '), seg('"net/http"', 'string')),
      line(seg('  '), seg('"time"', 'string')),
      line(seg(')')),
      line(),
      line(seg('type ', 'keyword'), seg('Server', 'type'), seg(' struct ', 'keyword'), seg('{')),
      line(seg('  '), seg('addr', 'property'), seg('    '), seg('string', 'type')),
      line(seg('  '), seg('timeout', 'property'), seg(' '), seg('time', 'namespace'), seg('.'), seg('Duration', 'type')),
      line(seg('  '), seg('mux', 'property'), seg('     *'), seg('http', 'namespace'), seg('.'), seg('ServeMux', 'type')),
      line(seg('}')),
      line(),
      line(seg('func ', 'keyword'), seg('New', 'function'), seg('('), seg('addr', 'parameter'), seg(' string', 'type'), seg(') *'), seg('Server', 'type'), seg(' {')),
      line(seg('  return ', 'keyword'), seg('&'), seg('Server', 'type'), seg('{')),
      line(seg('    '), seg('addr', 'property'), seg(':    '), seg('addr', 'parameter'), seg(',')),
      line(seg('    '), seg('timeout', 'property'), seg(': '), seg('10', 'number'), seg(' * '), seg('time', 'namespace'), seg('.'), seg('Second', 'property'), seg(',')),
      line(seg('    '), seg('mux', 'property'), seg(':     '), seg('http', 'namespace'), seg('.'), seg('NewServeMux', 'function.defaultLibrary'), seg('(),')),
      line(seg('  }')),
      line(seg('}')),
    ],
  },
  rs: {
    activeLine: 11,
    lines: [
      line(seg('// typed parser with Result and Option', 'comment')),
      line(seg('use ', 'keyword'), seg('std', 'namespace'), seg('::'), seg('collections', 'namespace'), seg('::'), seg('HashMap', 'type'), seg(';')),
      line(),
      line(seg('#[derive(Debug, Clone)]', 'decorator')),
      line(seg('struct ', 'keyword'), seg('Config', 'type'), seg(' {')),
      line(seg('    '), seg('host', 'property'), seg(': '), seg('String', 'type'), seg(',')),
      line(seg('    '), seg('port', 'property'), seg(': '), seg('u16', 'type'), seg(',')),
      line(seg('}')),
      line(),
      line(seg('fn ', 'keyword'), seg('load_config', 'function'), seg('('), seg('env', 'parameter'), seg(': &'), seg('HashMap', 'type'), seg('<'), seg('String', 'type'), seg(', '), seg('String', 'type'), seg('>) -> '), seg('Result', 'type'), seg('<'), seg('Config', 'type'), seg(', '), seg('String', 'type'), seg('> {')),
      line(seg('    let ', 'keyword'), seg('host', 'variable'), seg(' = ', 'operator'), seg('env', 'parameter'), seg('.'), seg('get', 'method'), seg('('), seg('"HOST"', 'string'), seg(').'), seg('cloned', 'method'), seg('().'), seg('unwrap_or_else', 'method.defaultLibrary'), seg('(|| '), seg('"127.0.0.1"', 'string'), seg('.'), seg('into', 'method.defaultLibrary'), seg('());')),
      line(seg('    let ', 'keyword'), seg('port', 'variable'), seg(' = ', 'operator'), seg('env', 'parameter')),
      line(seg('        .'), seg('get', 'method'), seg('('), seg('"PORT"', 'string'), seg(')')),
      line(seg('        .'), seg('and_then', 'method'), seg('(|'), seg('v', 'parameter'), seg('| '), seg('v', 'parameter'), seg('.'), seg('parse', 'method.defaultLibrary'), seg('::<'), seg('u16', 'type'), seg('>().'), seg('ok', 'method.defaultLibrary'), seg('())')),
      line(seg('        .'), seg('unwrap_or', 'method.defaultLibrary'), seg('('), seg('8080', 'number'), seg(');')),
      line(seg('    '), seg('Ok', 'function.defaultLibrary'), seg('('), seg('Config', 'type'), seg(' { '), seg('host', 'property'), seg(', '), seg('port', 'property'), seg(' })')),
      line(seg('}')),
    ],
  },
  java: {
    activeLine: 13,
    lines: [
      line(seg('// immutable service model with records', 'comment')),
      line(seg('import ', 'keyword'), seg('java.time', 'namespace'), seg('.'), seg('Duration', 'type'), seg(';')),
      line(seg('import ', 'keyword'), seg('java.util', 'namespace'), seg('.'), seg('List', 'type'), seg(';')),
      line(),
      line(seg('public ', 'keyword'), seg('final ', 'keyword'), seg('class ', 'keyword'), seg('VesperService', 'type'), seg(' {')),
      line(seg('  private ', 'keyword'), seg('final ', 'keyword'), seg('String', 'type'), seg(' endpoint', 'property'), seg(';')),
      line(seg('  private ', 'keyword'), seg('final ', 'keyword'), seg('Duration', 'type'), seg(' timeout', 'property'), seg(';')),
      line(),
      line(seg('  public ', 'keyword'), seg('VesperService', 'type'), seg('('), seg('String', 'type'), seg(' endpoint', 'parameter'), seg(') {')),
      line(seg('    this'), seg('.'), seg('endpoint', 'property'), seg(' = '), seg('endpoint', 'parameter'), seg(';')),
      line(seg('    this'), seg('.'), seg('timeout', 'property'), seg(' = '), seg('Duration', 'type'), seg('.'), seg('ofSeconds', 'method.defaultLibrary'), seg('('), seg('5', 'number'), seg(');')),
      line(seg('  }')),
      line(),
      line(seg('  public ', 'keyword'), seg('record ', 'keyword'), seg('Result', 'type'), seg('<'), seg('T', 'type'), seg('>('), seg('T', 'parameter'), seg(' data', 'property'), seg(', int ', 'type'), seg('status', 'property'), seg(') {}')),
      line(seg('}')),
    ],
  },
  bash: {
    activeLine: 6,
    lines: [
      line(seg('#!/usr/bin/env bash', 'comment')),
      line(seg('set ', 'function.defaultLibrary'), seg('-euo pipefail')),
      line(),
      line(seg('APP_NAME', 'variable.readonly'), seg('='), seg('"vesper"', 'string')),
      line(seg('BUILD_DIR', 'variable.readonly'), seg('='), seg('"./dist"', 'string')),
      line(),
      line(seg('echo ', 'function.defaultLibrary'), seg('"['), seg('${APP_NAME}', 'variable'), seg('] cleaning old build"', 'string')),
      line(seg('rm ', 'function.defaultLibrary'), seg('-rf '), seg('"${BUILD_DIR}"', 'string')),
      line(),
      line(seg('echo ', 'function.defaultLibrary'), seg('"['), seg('${APP_NAME}', 'variable'), seg('] building site"', 'string')),
      line(seg('npm ', 'function.defaultLibrary'), seg('run build', 'plain')),
    ],
  },
}
