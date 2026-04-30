/**
 * Sample-payload generators for SAP CPI iFlow endpoint test runner.
 *
 * Goal: produce *good-enough* request payloads from a schema so the user can
 * tweak and submit. Not a fully spec-compliant generator.
 */

import { XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  preserveOrder: false,
  trimValues: true,
});

export interface GeneratedPayload {
  method: string;
  contentType: string;
  body: string;
  /** Free-form helpful tips shown above the editor. */
  hints: string[];
}

// ============================================================================
// WSDL → SOAP envelope
// ============================================================================

export interface WsdlOperationSummary {
  name: string;
  inputElement: string | null;
  soapAction: string | null;
}

export interface WsdlSummary {
  targetNamespace: string;
  serviceName: string | null;
  portAddress: string | null;
  operations: WsdlOperationSummary[];
  schemas: XsdSchemaModel[];
}

// ----- Embedded XSD model used to generate sample SOAP bodies -----

interface XsdElement {
  name?: string;
  ref?: string;
  type?: string;
  inlineType?: XsdComplexType;
  inlineSimpleBase?: string;
  minOccurs?: number;
  maxOccurs?: number | "unbounded";
}

interface XsdComplexType {
  name?: string;
  elements: XsdElement[];
}

export interface XsdSchemaModel {
  targetNamespace: string;
  elementFormDefault: "qualified" | "unqualified";
  elements: Map<string, XsdElement>;
  complexTypes: Map<string, XsdComplexType>;
}

export function parseWsdl(xml: string): WsdlSummary | null {
  try {
    const doc = xmlParser.parse(xml);
    const root = findFirstKeyDeep(doc, /:?definitions$/i);
    if (!root) return null;
    const tns = root["@_targetNamespace"] || "";
    const services = ensureArray(findChildren(root, /:?service$/i));
    const ports = services.flatMap((s) => ensureArray(findChildren(s, /:?port$/i)));
    const portAddress = (() => {
      for (const p of ports) {
        const addr = findChildren(p, /:?address$/i)[0];
        if (addr && addr["@_location"]) return addr["@_location"] as string;
      }
      return null;
    })();

    // Parse <wsdl:types><xsd:schema>... — collect element + complexType maps.
    const schemas: XsdSchemaModel[] = [];
    for (const typesNode of findChildren(root, /:?types$/i)) {
      for (const sch of findChildren(typesNode, /:?schema$/i)) {
        const stns = (sch["@_targetNamespace"] as string) || tns || "";
        const efd =
          (sch["@_elementFormDefault"] as string) === "qualified"
            ? "qualified"
            : "unqualified";
        const elements = new Map<string, XsdElement>();
        const complexTypes = new Map<string, XsdComplexType>();
        for (const el of findChildren(sch, /:?element$/i)) {
          const e = parseXsdElement(el);
          if (e.name) elements.set(e.name, e);
        }
        for (const ct of findChildren(sch, /:?complexType$/i)) {
          const c = parseXsdComplexType(ct);
          if (c.name) complexTypes.set(c.name, c);
        }
        schemas.push({ targetNamespace: stns, elementFormDefault: efd, elements, complexTypes });
      }
    }

    // Map message name -> element local name (resolved from <wsdl:part element="..."/>).
    const messageElementMap = new Map<string, string>();
    for (const m of ensureArray(findChildren(root, /:?message$/i))) {
      const mname = m["@_name"] as string | undefined;
      if (!mname) continue;
      const part = findChildren(m, /:?part$/i)[0];
      const elementRef = part?.["@_element"] as string | undefined;
      const typeRef = part?.["@_type"] as string | undefined;
      const localName = (elementRef ?? typeRef)?.split(":").pop();
      if (localName) messageElementMap.set(mname, localName);
    }

    const portTypes = ensureArray(findChildren(root, /:?portType$/i));
    const operations: WsdlOperationSummary[] = [];
    for (const pt of portTypes) {
      for (const op of ensureArray(findChildren(pt, /:?operation$/i))) {
        const name = op["@_name"] || "operation";
        const input = findChildren(op, /:?input$/i)[0];
        const messageRef = input?.["@_message"] as string | undefined;
        const messageLocal = messageRef?.split(":").pop();
        const inputElement = messageLocal
          ? messageElementMap.get(messageLocal) ?? messageLocal
          : null;
        operations.push({
          name,
          inputElement,
          soapAction: null, // resolved from binding below
        });
      }
    }
    // Walk bindings for SOAPAction
    const bindings = ensureArray(findChildren(root, /:?binding$/i));
    for (const b of bindings) {
      for (const bop of ensureArray(findChildren(b, /:?operation$/i))) {
        const opName = bop["@_name"];
        const so = findChildren(bop, /:?operation$/i)[0];
        const action = so?.["@_soapAction"];
        if (action) {
          const found = operations.find((o) => o.name === opName);
          if (found) found.soapAction = action;
        }
      }
    }
    const serviceName = services[0]?.["@_name"] || null;
    return { targetNamespace: tns, serviceName, portAddress, operations, schemas };
  } catch {
    return null;
  }
}

function parseXsdElement(node: any): XsdElement {
  const name = node["@_name"] as string | undefined;
  const ref = node["@_ref"] as string | undefined;
  const type = node["@_type"] as string | undefined;
  const minOccursAttr = node["@_minOccurs"];
  const maxOccursAttr = node["@_maxOccurs"];
  const minOccurs =
    minOccursAttr != null && minOccursAttr !== "" ? Number(minOccursAttr) : undefined;
  const maxOccurs =
    maxOccursAttr === "unbounded"
      ? "unbounded"
      : maxOccursAttr != null && maxOccursAttr !== ""
        ? Number(maxOccursAttr)
        : undefined;
  const inlineCt = findChildren(node, /:?complexType$/i)[0];
  const inlineType = inlineCt ? parseXsdComplexType(inlineCt) : undefined;
  let inlineSimpleBase: string | undefined;
  const inlineSt = findChildren(node, /:?simpleType$/i)[0];
  if (inlineSt) {
    const restr = findChildren(inlineSt, /:?restriction$/i)[0];
    const base = restr?.["@_base"] as string | undefined;
    inlineSimpleBase = base ?? "xsd:string";
  }
  return { name, ref, type, inlineType, inlineSimpleBase, minOccurs, maxOccurs };
}

function parseXsdComplexType(node: any): XsdComplexType {
  const name = node["@_name"] as string | undefined;
  const elements: XsdElement[] = [];
  collectXsdChildElements(node, elements);
  return { name, elements };
}

function collectXsdChildElements(node: any, out: XsdElement[]): void {
  for (const group of findChildren(node, /:?(sequence|all|choice)$/i)) {
    for (const el of findChildren(group, /:?element$/i)) {
      out.push(parseXsdElement(el));
    }
    // Nested groups
    collectXsdChildElements(group, out);
  }
  for (const cc of findChildren(node, /:?complexContent$/i)) {
    for (const ext of findChildren(cc, /:?extension$/i)) {
      collectXsdChildElements(ext, out);
    }
    for (const restr of findChildren(cc, /:?restriction$/i)) {
      collectXsdChildElements(restr, out);
    }
  }
}

type ResolvedXsdType =
  | { kind: "simple"; xsdType: string }
  | { kind: "complex"; ct: XsdComplexType };

function resolveXsdElement(
  el: XsdElement,
  schemas: XsdSchemaModel[],
): ResolvedXsdType | null {
  if (el.ref) {
    const refLocal = el.ref.split(":").pop();
    if (refLocal) {
      for (const s of schemas) {
        const target = s.elements.get(refLocal);
        if (target) return resolveXsdElement(target, schemas);
      }
    }
    return null;
  }
  if (el.inlineType) return { kind: "complex", ct: el.inlineType };
  if (el.inlineSimpleBase) return { kind: "simple", xsdType: el.inlineSimpleBase };
  if (el.type) {
    if (isXsdSimpleType(el.type)) return { kind: "simple", xsdType: el.type };
    const tLocal = el.type.split(":").pop();
    if (tLocal) {
      for (const s of schemas) {
        const ct = s.complexTypes.get(tLocal);
        if (ct) return { kind: "complex", ct };
      }
    }
    // Unknown referenced type — fall back to a string-like value.
    return { kind: "simple", xsdType: "xsd:string" };
  }
  // No type, no ref, no inline definition — treat as plain string leaf so we
  // still emit a useful sample value rather than an empty element.
  return { kind: "simple", xsdType: "xsd:string" };
}

function isXsdSimpleType(typeRef: string): boolean {
  const local = typeRef.split(":").pop()?.toLowerCase() ?? "";
  return [
    "string",
    "normalizedstring",
    "token",
    "language",
    "name",
    "ncname",
    "id",
    "idref",
    "int",
    "integer",
    "long",
    "short",
    "byte",
    "unsignedint",
    "unsignedlong",
    "unsignedshort",
    "unsignedbyte",
    "positiveinteger",
    "nonnegativeinteger",
    "negativeinteger",
    "nonpositiveinteger",
    "decimal",
    "double",
    "float",
    "boolean",
    "date",
    "datetime",
    "time",
    "gyear",
    "gmonth",
    "gday",
    "gyearmonth",
    "gmonthday",
    "duration",
    "base64binary",
    "hexbinary",
    "anyuri",
    "qname",
    "anytype",
    "anysimpletype",
  ].includes(local);
}

function sampleForXsdType(typeRef: string, fieldName?: string): string {
  const local = typeRef.split(":").pop()?.toLowerCase() ?? "";
  switch (local) {
    case "boolean":
      return "false";
    case "int":
    case "integer":
    case "long":
    case "short":
    case "byte":
    case "unsignedint":
    case "unsignedlong":
    case "unsignedshort":
    case "unsignedbyte":
    case "positiveinteger":
    case "nonnegativeinteger":
      return "0";
    case "negativeinteger":
    case "nonpositiveinteger":
      return "-1";
    case "decimal":
    case "double":
    case "float":
      return "0.00";
    case "datetime":
      return new Date().toISOString();
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "time":
      return "00:00:00";
    case "gyear":
      return String(new Date().getFullYear());
    case "gmonth":
      return "--01";
    case "gday":
      return "---01";
    case "duration":
      return "P0D";
    case "base64binary":
    case "hexbinary":
      return "";
    case "anyuri":
      return "https://example.com";
    default:
      return sampleForFieldName(fieldName ?? "string");
  }
}

function sampleForFieldName(name: string): string {
  const n = name.toLowerCase();
  if (/email/.test(n)) return "user@example.com";
  if (/phone|mobile|tel|fax/.test(n)) return "+1-555-0100";
  if (/postcode|postal|zip/.test(n)) return "12345";
  if (/country/.test(n)) return "US";
  if (/state|province|region/.test(n)) return "CA";
  if (/city|town/.test(n)) return "Sample City";
  if (/street|address/.test(n)) return "123 Sample St";
  if (/firstname|givenname/.test(n)) return "John";
  if (/lastname|surname|familyname/.test(n)) return "Doe";
  if (/middlename|secondname/.test(n)) return "M";
  if (/^name$|fullname/.test(n)) return "John Doe";
  if (/url|uri|link/.test(n)) return "https://example.com";
  if (/currency/.test(n)) return "USD";
  if (/language|locale/.test(n)) return "en";
  if (/amount|price|total|cost|value/.test(n)) return "0.00";
  if (/qty|quantity|count|number/.test(n)) return "1";
  if (/date/.test(n)) return new Date().toISOString().slice(0, 10);
  if (/time/.test(n)) return new Date().toISOString();
  if (/uuid|guid/.test(n)) return "00000000-0000-0000-0000-000000000000";
  if (/^id$|.*id$/.test(n)) return "SAMPLE_ID";
  if (/account|iban/.test(n)) return "0000000000";
  if (/bsb|routing|swift|bic/.test(n)) return "000-000";
  if (/holder/.test(n)) return "John Doe";
  if (/code/.test(n)) return "CODE";
  if (/description|comment|note/.test(n)) return "Sample description";
  if (/status|state/.test(n)) return "ACTIVE";
  return `Sample ${name}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderSampleElement(
  localName: string,
  resolved: ResolvedXsdType,
  schemas: XsdSchemaModel[],
  prefix: string,
  childPrefix: string,
  indent: string,
  childIndent: string,
  depth: number,
  visited: Set<string>,
): string {
  if (resolved.kind === "simple") {
    return `${indent}<${prefix}${localName}>${escapeXml(
      sampleForXsdType(resolved.xsdType, localName),
    )}</${prefix}${localName}>`;
  }
  const ct = resolved.ct;
  if (ct.elements.length === 0) {
    return `${indent}<${prefix}${localName}/>`;
  }
  const visitKey = ct.name ?? `__inline_${localName}_${depth}`;
  if (ct.name && visited.has(visitKey)) {
    return `${indent}<${prefix}${localName}><!-- recursive ${ct.name} --></${prefix}${localName}>`;
  }
  if (depth > 8) {
    return `${indent}<${prefix}${localName}><!-- depth limit --></${prefix}${localName}>`;
  }
  const next = new Set(visited);
  if (ct.name) next.add(visitKey);
  const lines: string[] = [];
  for (const child of ct.elements) {
    const cName = child.name ?? child.ref?.split(":").pop();
    if (!cName) continue;
    const childResolved = resolveXsdElement(child, schemas);
    if (!childResolved) {
      lines.push(`${childIndent}<${childPrefix}${cName}/>`);
      continue;
    }
    const isArray = child.maxOccurs === "unbounded" || (typeof child.maxOccurs === "number" && child.maxOccurs > 1);
    const occurrences = isArray ? 1 : 1; // emit a single representative element
    for (let i = 0; i < occurrences; i++) {
      lines.push(
        renderSampleElement(
          cName,
          childResolved,
          schemas,
          childPrefix,
          childPrefix,
          childIndent,
          childIndent + "  ",
          depth + 1,
          next,
        ),
      );
    }
    if (isArray) {
      lines.push(`${childIndent}<!-- repeat <${childPrefix}${cName}> as needed -->`);
    }
  }
  return `${indent}<${prefix}${localName}>\n${lines.join("\n")}\n${indent}</${prefix}${localName}>`;
}

export function generateSoapEnvelope(
  wsdl: WsdlSummary,
  operationName?: string,
): GeneratedPayload {
  const op =
    wsdl.operations.find((o) => o.name === operationName) ||
    wsdl.operations[0];
  const elementName = op?.inputElement || op?.name || "Request";

  // Find the matching top-level element across the embedded schemas.
  let topElement: XsdElement | undefined;
  let topSchema: XsdSchemaModel | undefined;
  for (const s of wsdl.schemas) {
    const e = s.elements.get(elementName);
    if (e) {
      topElement = e;
      topSchema = s;
      break;
    }
  }
  const ns = topSchema?.targetNamespace || wsdl.targetNamespace || "http://example.com";
  // Match SAP CPI Test Console rendering: declare xmlns:tns on the operation
  // element itself and emit child elements unqualified (no prefix). This is
  // how SAP renders generated samples regardless of elementFormDefault, and
  // is friendlier to read/edit than fully-prefixed payloads.
  const childPrefix = "";
  const openTag = `<tns:${elementName} xmlns:tns="${ns}">`;
  const closeTag = `</tns:${elementName}>`;

  let elementXml: string;
  let sampleHint = "";
  if (topElement) {
    const resolved = resolveXsdElement(topElement, wsdl.schemas);
    if (resolved && resolved.kind === "complex") {
      const ct = resolved.ct;
      if (ct.elements.length === 0) {
        elementXml = `    ${openTag}${closeTag}`;
      } else {
        const innerLines: string[] = [];
        for (const child of ct.elements) {
          const cName = child.name ?? child.ref?.split(":").pop();
          if (!cName) continue;
          const childResolved = resolveXsdElement(child, wsdl.schemas);
          if (!childResolved) {
            innerLines.push(`      <${cName}/>`);
            continue;
          }
          innerLines.push(
            renderSampleElement(
              cName,
              childResolved,
              wsdl.schemas,
              childPrefix,
              childPrefix,
              "      ",
              "        ",
              1,
              new Set(),
            ),
          );
        }
        elementXml = `    ${openTag}\n${innerLines.join("\n")}\n    ${closeTag}`;
      }
      sampleHint = "Sample fields populated from the WSDL — replace placeholder values before sending.";
    } else if (resolved && resolved.kind === "simple") {
      elementXml = `    ${openTag}${escapeXml(
        sampleForXsdType(resolved.xsdType, elementName),
      )}${closeTag}`;
      sampleHint = "Sample value populated from the WSDL — replace placeholder before sending.";
    } else {
      elementXml = `    ${openTag}\n      <!-- TODO: fill request fields -->\n    ${closeTag}`;
    }
  } else {
    elementXml = `    ${openTag}\n      <!-- TODO: fill request fields. Operation element not found in WSDL types. -->\n    ${closeTag}`;
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${elementXml}
  </soap:Body>
</soap:Envelope>
`;
  return {
    method: "POST",
    contentType: "text/xml; charset=UTF-8",
    body,
    hints: [
      op?.soapAction ? `SOAPAction: ${op.soapAction}` : "Add a SOAPAction header if required.",
      `Operation: ${op?.name ?? "(none in WSDL)"}`,
      `Target namespace: ${ns}`,
      sampleHint,
    ].filter(Boolean),
  };
}

// ============================================================================
// IDoc/SOAP — same envelope but with EDI_DC40 hints
// ============================================================================

export function generateIdocSoapEnvelope(wsdl: WsdlSummary): GeneratedPayload {
  const base = generateSoapEnvelope(wsdl);
  base.hints.unshift(
    "IDoc payloads need EDI_DC40 control segment fields (DOCNUM, IDOCTYP, MESTYP, SNDPRN, RCVPRN, …).",
  );
  return base;
}

// ============================================================================
// OData $metadata → entity sets / function imports
// ============================================================================

export interface ODataEntitySet {
  name: string;
  entityType: string;
}

export interface ODataMetadataSummary {
  namespace: string;
  entitySets: ODataEntitySet[];
  entityTypeProperties: Record<string, Array<{ name: string; type: string; nullable: boolean }>>;
}

export function parseODataMetadata(xml: string): ODataMetadataSummary | null {
  try {
    const doc = xmlParser.parse(xml);
    const edmx = findFirstKeyDeep(doc, /:?Edmx$/);
    const services = findFirstKeyDeep(edmx ?? doc, /:?DataServices$/);
    const schema = findChildren(services ?? edmx ?? doc, /:?Schema$/)[0];
    if (!schema) return null;
    const namespace = (schema["@_Namespace"] as string) || "";
    const containers = ensureArray(findChildren(schema, /:?EntityContainer$/));
    const entitySets: ODataEntitySet[] = [];
    for (const c of containers) {
      for (const es of ensureArray(findChildren(c, /:?EntitySet$/))) {
        entitySets.push({
          name: es["@_Name"] as string,
          entityType: ((es["@_EntityType"] as string) || "").split(".").pop() || "",
        });
      }
    }
    const entityTypeProperties: ODataMetadataSummary["entityTypeProperties"] = {};
    for (const et of ensureArray(findChildren(schema, /:?EntityType$/))) {
      const name = et["@_Name"] as string;
      entityTypeProperties[name] = ensureArray(findChildren(et, /:?Property$/)).map(
        (p) => ({
          name: p["@_Name"] as string,
          type: (p["@_Type"] as string) || "Edm.String",
          nullable: p["@_Nullable"] !== "false",
        }),
      );
    }
    return { namespace, entitySets, entityTypeProperties };
  } catch {
    return null;
  }
}

export function generateODataPayload(
  meta: ODataMetadataSummary,
  entitySetName?: string,
): GeneratedPayload {
  const set =
    meta.entitySets.find((s) => s.name === entitySetName) || meta.entitySets[0];
  if (!set) {
    return {
      method: "GET",
      contentType: "application/json",
      body: "",
      hints: ["No entity sets found in $metadata."],
    };
  }
  const props = meta.entityTypeProperties[set.entityType] || [];
  const sample: Record<string, unknown> = {};
  for (const p of props) sample[p.name] = sampleForEdmType(p.type);
  return {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify(sample, null, 2),
    hints: [
      `Entity set: ${set.name} (${set.entityType})`,
      "Append the entity set to the URL path for create operations.",
      "Use GET (no body) to query the collection.",
    ],
  };
}

function sampleForEdmType(type: string): unknown {
  const t = type.replace(/^Edm\./, "");
  switch (t) {
    case "Boolean":
      return false;
    case "Byte":
    case "SByte":
    case "Int16":
    case "Int32":
    case "Int64":
      return 0;
    case "Decimal":
    case "Double":
    case "Single":
      return 0.0;
    case "DateTime":
    case "DateTimeOffset":
      return new Date().toISOString();
    case "Date":
      return new Date().toISOString().slice(0, 10);
    case "Time":
    case "TimeOfDay":
      return "00:00:00";
    case "Guid":
      return "00000000-0000-0000-0000-000000000000";
    case "Binary":
      return "";
    default:
      return "";
  }
}

// ============================================================================
// OpenAPI 3 → JSON sample
// ============================================================================

export interface OpenApiOperationSummary {
  method: string;
  path: string;
  operationId: string | null;
  contentType: string | null;
  /** A JSON sample for the first request body content type, when present. */
  sample: unknown;
}

export function parseOpenApi(text: string): OpenApiOperationSummary[] {
  let doc: any;
  try {
    doc = JSON.parse(text);
  } catch {
    return [];
  }
  const paths = doc?.paths || {};
  const ops: OpenApiOperationSummary[] = [];
  for (const [path, methods] of Object.entries<Record<string, any>>(paths)) {
    for (const [method, def] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const content = def?.requestBody?.content || {};
      const ct = Object.keys(content)[0] || null;
      const schema = ct ? content[ct].schema : null;
      ops.push({
        method: method.toUpperCase(),
        path,
        operationId: def?.operationId || null,
        contentType: ct,
        sample: schema ? sampleFromJsonSchema(schema, doc) : null,
      });
    }
  }
  return ops;
}

export function generateRestPayload(
  op: OpenApiOperationSummary | null,
): GeneratedPayload {
  if (!op || op.sample == null) {
    return {
      method: op?.method || "POST",
      contentType: op?.contentType || "application/json",
      body: "{}",
      hints: ["No request body schema found — sending empty JSON."],
    };
  }
  const isJson = (op.contentType || "application/json").includes("json");
  return {
    method: op.method,
    contentType: op.contentType || "application/json",
    body: isJson ? JSON.stringify(op.sample, null, 2) : String(op.sample),
    hints: [
      `Path: ${op.path}`,
      op.operationId ? `Operation: ${op.operationId}` : "",
    ].filter(Boolean) as string[],
  };
}

function sampleFromJsonSchema(schema: any, root: any, depth = 0): unknown {
  if (!schema || depth > 8) return null;
  if (schema.$ref) {
    const ref = String(schema.$ref).replace(/^#\//, "").split("/");
    let target: any = root;
    for (const seg of ref) target = target?.[seg];
    return sampleFromJsonSchema(target, root, depth + 1);
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  const type = schema.type || (schema.properties ? "object" : "string");
  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      const props = schema.properties || {};
      for (const [k, v] of Object.entries<any>(props)) {
        out[k] = sampleFromJsonSchema(v, root, depth + 1);
      }
      return out;
    }
    case "array":
      return [sampleFromJsonSchema(schema.items || {}, root, depth + 1)];
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    default: {
      const fmt = schema.format || "";
      if (fmt === "date-time") return new Date().toISOString();
      if (fmt === "date") return new Date().toISOString().slice(0, 10);
      if (fmt === "uuid") return "00000000-0000-0000-0000-000000000000";
      if (fmt === "email") return "user@example.com";
      return "";
    }
  }
}

// ============================================================================
// internal XML helpers
// ============================================================================

function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function findChildren(node: any, keyPattern: RegExp): any[] {
  if (!node || typeof node !== "object") return [];
  const out: any[] = [];
  for (const [k, v] of Object.entries(node)) {
    if (keyPattern.test(k)) {
      out.push(...ensureArray(v));
    }
  }
  return out;
}

function findFirstKeyDeep(node: any, keyPattern: RegExp): any | null {
  if (!node || typeof node !== "object") return null;
  for (const [k, v] of Object.entries(node)) {
    if (keyPattern.test(k)) return Array.isArray(v) ? v[0] : v;
    if (v && typeof v === "object") {
      const found = findFirstKeyDeep(v, keyPattern);
      if (found) return found;
    }
  }
  return null;
}

// ============================================================================
// Top-level dispatcher
// ============================================================================

export type SchemaKind = "WSDL" | "EDMX" | "OPENAPI" | "NONE";

export function detectSchemaKind(
  contentType: string,
  body: string,
): SchemaKind {
  const ct = contentType.toLowerCase();
  if (ct.includes("wsdl") || /<\s*[\w:]*definitions[\s>]/i.test(body)) return "WSDL";
  if (ct.includes("edmx") || /<\s*[\w:]*Edmx/i.test(body)) return "EDMX";
  if (ct.includes("json") || body.trimStart().startsWith("{")) {
    try {
      const j = JSON.parse(body);
      if (j.openapi || j.swagger) return "OPENAPI";
    } catch {
      // fall-through
    }
  }
  return "NONE";
}
