const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toDosTimeDate = (date: Date): { time: number; date: number } => {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time: dosTime, date: dosDate };
};

const writeUint16 = (view: DataView, offset: number, value: number): void => {
  view.setUint16(offset, value & 0xffff, true);
};

const writeUint32 = (view: DataView, offset: number, value: number): void => {
  view.setUint32(offset, value >>> 0, true);
};

const readUint16 = (view: DataView, offset: number): number => view.getUint16(offset, true);
const readUint32 = (view: DataView, offset: number): number => view.getUint32(offset, true);

export const createSingleFileZip = (fileName: string, content: string): Blob => {
  const nameBytes = textEncoder.encode(fileName);
  const dataBytes = textEncoder.encode(content);
  const crc = crc32(dataBytes);
  const { time, date } = toDosTimeDate(new Date());

  const localHeaderSize = 30 + nameBytes.length;
  const centralHeaderSize = 46 + nameBytes.length;
  const endSize = 22;
  const totalSize = localHeaderSize + dataBytes.length + centralHeaderSize + endSize;

  const output = new Uint8Array(totalSize);
  const view = new DataView(output.buffer);

  let offset = 0;

  // Local file header
  writeUint32(view, offset + 0, ZIP_LOCAL_FILE_HEADER_SIGNATURE);
  writeUint16(view, offset + 4, 20); // version needed
  writeUint16(view, offset + 6, 0); // flags
  writeUint16(view, offset + 8, 0); // store (no compression)
  writeUint16(view, offset + 10, time);
  writeUint16(view, offset + 12, date);
  writeUint32(view, offset + 14, crc);
  writeUint32(view, offset + 18, dataBytes.length);
  writeUint32(view, offset + 22, dataBytes.length);
  writeUint16(view, offset + 26, nameBytes.length);
  writeUint16(view, offset + 28, 0); // extra length
  output.set(nameBytes, offset + 30);
  offset += localHeaderSize;

  output.set(dataBytes, offset);
  offset += dataBytes.length;

  const centralStart = offset;

  // Central directory header
  writeUint32(view, offset + 0, ZIP_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(view, offset + 4, 20); // version made by
  writeUint16(view, offset + 6, 20); // version needed
  writeUint16(view, offset + 8, 0); // flags
  writeUint16(view, offset + 10, 0); // store
  writeUint16(view, offset + 12, time);
  writeUint16(view, offset + 14, date);
  writeUint32(view, offset + 16, crc);
  writeUint32(view, offset + 20, dataBytes.length);
  writeUint32(view, offset + 24, dataBytes.length);
  writeUint16(view, offset + 28, nameBytes.length);
  writeUint16(view, offset + 30, 0); // extra len
  writeUint16(view, offset + 32, 0); // comment len
  writeUint16(view, offset + 34, 0); // disk start
  writeUint16(view, offset + 36, 0); // internal attrs
  writeUint32(view, offset + 38, 0); // external attrs
  writeUint32(view, offset + 42, 0); // local header offset
  output.set(nameBytes, offset + 46);
  offset += centralHeaderSize;

  const centralSize = offset - centralStart;

  // End of central directory
  writeUint32(view, offset + 0, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(view, offset + 4, 0); // disk number
  writeUint16(view, offset + 6, 0); // start disk
  writeUint16(view, offset + 8, 1); // total entries on this disk
  writeUint16(view, offset + 10, 1); // total entries
  writeUint32(view, offset + 12, centralSize);
  writeUint32(view, offset + 16, centralStart);
  writeUint16(view, offset + 20, 0); // comment length

  return new Blob([output], { type: 'application/zip' });
};

const findEndOfCentralDirectory = (bytes: Uint8Array): number => {
  // EOCD minimum size is 22 bytes
  for (let i = bytes.length - 22; i >= 0; i--) {
    const sig = readUint32(new DataView(bytes.buffer), i);
    if (sig === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return i;
    }
  }
  return -1;
};

export const readSingleFileZip = async (file: Blob): Promise<{ fileName: string; content: string }> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);

  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP: EOCD not found');
  }

  const centralDirectoryOffset = readUint32(view, eocdOffset + 16);
  if (readUint32(view, centralDirectoryOffset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
    throw new Error('Invalid ZIP: central directory header not found');
  }

  const compressionMethod = readUint16(view, centralDirectoryOffset + 10);
  if (compressionMethod !== 0) {
    throw new Error('Unsupported ZIP compression method');
  }

  const fileNameLength = readUint16(view, centralDirectoryOffset + 28);
  const extraLength = readUint16(view, centralDirectoryOffset + 30);
  const commentLength = readUint16(view, centralDirectoryOffset + 32);
  const compressedSize = readUint32(view, centralDirectoryOffset + 20);
  const localHeaderOffset = readUint32(view, centralDirectoryOffset + 42);

  const fileNameBytes = bytes.slice(
    centralDirectoryOffset + 46,
    centralDirectoryOffset + 46 + fileNameLength
  );
  const fileName = textDecoder.decode(fileNameBytes);

  const nextHeaderOffset = centralDirectoryOffset + 46 + fileNameLength + extraLength + commentLength;
  if (nextHeaderOffset > bytes.length) {
    throw new Error('Invalid ZIP: out-of-range central directory');
  }

  if (readUint32(view, localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error('Invalid ZIP: local file header not found');
  }

  const localNameLength = readUint16(view, localHeaderOffset + 26);
  const localExtraLength = readUint16(view, localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + compressedSize;

  if (dataEnd > bytes.length) {
    throw new Error('Invalid ZIP: out-of-range file data');
  }

  const dataBytes = bytes.slice(dataStart, dataEnd);
  const content = textDecoder.decode(dataBytes);
  return { fileName, content };
};
