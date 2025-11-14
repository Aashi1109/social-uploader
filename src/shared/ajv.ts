import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true }); // keep strict defaults
addFormats(ajv);

ajv.addKeyword({
  keyword: "x-meta",
  schemaType: ["object"],
  validate: () => true,
});

export default ajv;
