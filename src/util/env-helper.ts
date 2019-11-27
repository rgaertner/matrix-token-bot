import { MatrixConnectorConfig } from '../matrix-connector';

export const fromEnv = (envVar: string) => {
  const val = process.env[envVar];
  if (!val) {
    throw new Error(`Please provide env var ${envVar}`);
  }
  return val;
};

export const matrixConfig  = (): MatrixConnectorConfig => {
  return {
    userId: fromEnv('USER_ID'),
    accessToken: fromEnv('ACCESS_TOKEN'),
    roomId: fromEnv('ROOM_ID'),
    baseUrl: fromEnv('MATRIX_URL'),
  };
};
