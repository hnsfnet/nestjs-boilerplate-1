import crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';

export function generateSessionHash(): string {
  return crypto.createHash('sha256').update(randomStringGenerator()).digest('hex');
}
