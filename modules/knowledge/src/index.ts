export { knowledgeModule, knowledgeFor } from "./module";
export { knowledgeRoutes } from "./routes";
export {
  addDocument,
  createBase,
  getBase,
  ingest,
  listBases,
  search,
  INGEST_JOB,
  DEFAULT_EMBEDDING_MODEL,
  knownEmbeddingModels,
  type Hit,
} from "./service";
export { chunkText } from "./chunk";
export { htmlToText, pdfToText } from "./extract";
