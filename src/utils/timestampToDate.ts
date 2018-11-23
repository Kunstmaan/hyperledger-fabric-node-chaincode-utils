import { Timestamp } from 'google-protobuf/google/protobuf/timestamp_pb';

export default function toDate(timestamp: Timestamp): Date {
    const milliseconds = (timestamp.getSeconds() + ((timestamp.getNanos() / 1000000) / 1000)) * 1000;

    return new Date(milliseconds);
}
