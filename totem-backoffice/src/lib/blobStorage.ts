import "server-only";
import { BlobServiceClient, BlobSASPermissions, StorageSharedKeyCredential, generateBlobSASQueryParameters } from "@azure/storage-blob";
import { getEnv } from "./env";

function getStorage() {
  const env = getEnv();
  if (!env.AZURE_STORAGE_CONNECTION_STRING || !env.AZURE_STORAGE_CONTAINER) {
    throw new Error("Azure Blob Storage is not configured for this environment.");
  }
  const accountName = /(?:^|;)AccountName=([^;]+)/i.exec(env.AZURE_STORAGE_CONNECTION_STRING)?.[1];
  const accountKey = /(?:^|;)AccountKey=([^;]+)/i.exec(env.AZURE_STORAGE_CONNECTION_STRING)?.[1];
  if (!accountName || !accountKey) throw new Error("Azure Storage connection string is missing its account key.");
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const service = BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);
  return { container: service.getContainerClient(env.AZURE_STORAGE_CONTAINER), accountName, credential };
}

export function createBlobName(assetId: string) { return `assets/${assetId}`; }

export function createBlobSas(blobName: string, permissions: "cw" | "r", minutes: number) {
  const { container, accountName, credential } = getStorage();
  const expiresOn = new Date(Date.now() + minutes * 60_000);
  const sas = generateBlobSASQueryParameters({
    containerName: container.containerName,
    blobName,
    permissions: BlobSASPermissions.parse(permissions),
    startsOn: new Date(Date.now() - 60_000),
    expiresOn,
  }, credential).toString();
  return `${container.getBlockBlobClient(blobName).url}?${sas}`;
}

export function getBlobClient(blobName: string) {
  const { container } = getStorage();
  return container.getBlobClient(blobName);
}
