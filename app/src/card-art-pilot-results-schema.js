import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateCardArtPilotResults } from "./card-art-pilot-validation.js";

const compiledSchemas = new WeakMap();

function compileSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError("Schema Draft 2020-12 do piloto #176 ausente ou inválido");
  }
  if (compiledSchemas.has(schema)) return compiledSchemas.get(schema);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  compiledSchemas.set(schema, validate);
  return validate;
}

function schemaError(error) {
  const path = error.instancePath || "$";
  if (error.keyword === "additionalProperties") {
    return `schema${path}.${error.params.additionalProperty}: propriedade não permitida`;
  }
  if (error.keyword === "required") {
    return `schema${path}.${error.params.missingProperty}: campo obrigatório ausente`;
  }
  return `schema${path}: ${error.message}`;
}

export function validateCardArtPilotResultSchema(result, schema) {
  const validate = compileSchema(schema);
  if (validate(result)) return [];
  return validate.errors.map(schemaError);
}

export function validateCardArtPilotResultDocument(result, manifest, schema) {
  const schemaErrors = validateCardArtPilotResultSchema(result, schema);
  if (schemaErrors.length) return schemaErrors;
  return validateCardArtPilotResults(result, manifest);
}

export function assertCardArtPilotResultDocument(result, manifest, schema) {
  const errors = validateCardArtPilotResultDocument(result, manifest, schema);
  if (!errors.length) return;
  const error = new Error(`Resultado do piloto #176 inválido:\n- ${errors.join("\n- ")}`);
  error.validationErrors = errors;
  throw error;
}
