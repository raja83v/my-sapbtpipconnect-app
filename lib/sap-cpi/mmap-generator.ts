/**
 * Message Mapping Generator for SAP CPI
 *
 * Generates .mmap (Message Mapping) files that can be deployed to SAP CPI.
 * Message Mappings transform XML structures from source to target format.
 */

export interface MMapField {
    name: string;
    xpath: string;
    type: 'String' | 'Number' | 'Boolean' | 'Date' | 'Decimal' | 'Binary';
    nullable?: boolean;
    collection?: boolean;
    attributes?: MMapField[];
}

export interface MMapMappingRule {
    sourceField: MMapField;
    targetField: MMapField;
    transformation?: MMapTransformation;
}

export interface MMapTransformation {
    type: 'copy' | 'constant' | 'function' | 'expression' | 'concat' | 'split' | 'replace' | 'dateFormat' | 'numberFormat';
    params?: Record<string, string>;
}

export interface MessageMappingDefinition {
    id: string;
    name: string;
    sourceStructure: MMapField;
    targetStructure: MMapField;
    mappingRules: MMapMappingRule[];
    functions?: MMapFunction[];
}

export interface MMapFunction {
    id: string;
    name: string;
    category: 'string' | 'date' | 'number' | 'conversion' | 'boolean' | 'context';
    description: string;
    parameters: {
        name: string;
        type: 'source' | 'target' | 'constant';
        required: boolean;
    }[];
}

/**
 * Generate a Message Mapping .mmap file content
 */
export function generateMMapFile(mapping: MessageMappingDefinition): string {
    const lines: string[] = [];

    // Header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<mapping version="2.0">');

    // Header section
    lines.push('  <header>');
    lines.push(`    <id>${mapping.id}</id>`);
    lines.push(`    <name>${escapeXml(mapping.name)}</name>`);
    lines.push('  </header>');

    // Source structure
    lines.push('  <sourceStructure>');
    lines.push(...generateFieldXml(mapping.sourceStructure, '    '));
    lines.push('  </sourceStructure>');

    // Target structure
    lines.push('  <targetStructure>');
    lines.push(...generateFieldXml(mapping.targetStructure, '    '));
    lines.push('  </targetStructure>');

    // Mapping rules
    lines.push('  <mappings>');
    for (const rule of mapping.mappingRules) {
        lines.push('    <mapping>');
        lines.push(`      <source>${escapeXml(rule.sourceField.xpath)}</source>`);
        lines.push(`      <target>${escapeXml(rule.targetField.xpath)}</target>`);

        if (rule.transformation) {
            lines.push('      <transformation>');
            lines.push(`        <type>${rule.transformation.type}</type>`);
            if (rule.transformation.params) {
                lines.push('        <params>');
                for (const [key, value] of Object.entries(rule.transformation.params)) {
                    lines.push(`          <param name="${key}">${escapeXml(value)}</param>`);
                }
                lines.push('        </params>');
            }
            lines.push('      </transformation>');
        }

        lines.push('    </mapping>');
    }
    lines.push('  </mappings>');

    // Functions (custom functions used in mappings)
    if (mapping.functions && mapping.functions.length > 0) {
        lines.push('  <functions>');
        for (const func of mapping.functions) {
            lines.push('    <function>');
            lines.push(`      <id>${func.id}</id>`);
            lines.push(`      <name>${escapeXml(func.name)}</name>`);
            lines.push(`      <category>${func.category}</category>`);
            lines.push(`      <description>${escapeXml(func.description)}</description>`);
            lines.push('    </function>');
        }
        lines.push('  </functions>');
    }

    lines.push('</mapping>');

    return lines.join('\n');
}

/**
 * Generate XML for a field and its children
 */
function generateFieldXml(field: MMapField, indent: string): string[] {
    const lines: string[] = [];

    lines.push(`${indent}<field>`);
    lines.push(`${indent}  <name>${escapeXml(field.name)}</name>`);
    lines.push(`${indent}  <xpath>${escapeXml(field.xpath)}</xpath>`);
    lines.push(`${indent}  <type>${field.type}</type>`);

    if (field.nullable !== undefined) {
        lines.push(`${indent}  <nullable>${field.nullable}</nullable>`);
    }

    if (field.collection !== undefined) {
        lines.push(`${indent}  <collection>${field.collection}</collection>`);
    }

    if (field.attributes && field.attributes.length > 0) {
        lines.push(`${indent}<attributes>`);
        for (const attr of field.attributes) {
            lines.push(...generateFieldXml(attr, indent + '    '));
        }
        lines.push(`${indent}</attributes>`);
    }

    lines.push(`${indent}</field>`);

    return lines;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Convert a high-level mapping config to MessageMappingDefinition
 */
export function convertToMessageMappingDefinition(
    mappingId: string,
    mappingName: string,
    sourceFields: string[] = [],
    targetFields: string[] = [],
    transformations: string[] = []
): MessageMappingDefinition {
    // Parse source fields
    const sourceStructure = parseFields(sourceFields, '/source');

    // Parse target fields
    const targetStructure = parseFields(targetFields, '/target');

    // Generate mapping rules
    const mappingRules: MMapMappingRule[] = [];

    for (let i = 0; i < Math.min(sourceFields.length, targetFields.length); i++) {
        const sourceField = findFieldByXpath(sourceStructure, sourceFields[i]);
        const targetField = findFieldByXpath(targetStructure, targetFields[i]);

        if (sourceField && targetField) {
            const transformation: MMapTransformation | undefined = transformations[i]
                ? parseTransformation(transformations[i])
                : undefined;

            mappingRules.push({
                sourceField,
                targetField,
                transformation,
            });
        }
    }

    return {
        id: mappingId,
        name: mappingName,
        sourceStructure,
        targetStructure,
        mappingRules,
        functions: getStandardFunctions(),
    };
}

/**
 * Parse field definitions from string array
 */
function parseFields(fields: string[], basePath: string): MMapField {
    const root: MMapField = {
        name: 'Root',
        xpath: basePath,
        type: 'String',
        attributes: [],
    };

    for (const field of fields) {
        const parts = field.split('/').filter(p => p);
        let current = root;

        for (const part of parts) {
            let child = current.attributes?.find(a => a.name === part);

            if (!child) {
                child = {
                    name: part,
                    xpath: `${current.xpath}/${part}`,
                    type: 'String',
                    attributes: [],
                };
                current.attributes = current.attributes || [];
                current.attributes.push(child);
            }

            current = child;
        }
    }

    return root;
}

/**
 * Find a field by its xpath
 */
function findFieldByXpath(root: MMapField, xpath: string): MMapField | null {
    if (root.xpath === xpath) return root;

    if (root.attributes) {
        for (const attr of root.attributes) {
            const found = findFieldByXpath(attr, xpath);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Parse transformation string to MMapTransformation
 */
function parseTransformation(transformation: string): MMapTransformation {
    // Simple transformation parsing
    // Format: "type:param1=value1,param2=value2" or just "type"
    const parts = transformation.split(':');
    const type = parts[0] as MMapTransformation['type'];
    const params: Record<string, string> = {};

    if (parts[1]) {
        const paramParts = parts[1].split(',');
        for (const param of paramParts) {
            const [key, value] = param.split('=');
            if (key && value) {
                params[key] = value;
            }
        }
    }

    return { type, params };
}

/**
 * Get standard SAP CPI mapping functions
 */
function getStandardFunctions(): MMapFunction[] {
    return [
        // String functions
        {
            id: 'concat',
            name: 'concat',
            category: 'string',
            description: 'Concatenates multiple strings',
            parameters: [
                { name: 'str1', type: 'source', required: true },
                { name: 'str2', type: 'source', required: true },
            ],
        },
        {
            id: 'substring',
            name: 'substring',
            category: 'string',
            description: 'Extracts a substring',
            parameters: [
                { name: 'source', type: 'source', required: true },
                { name: 'start', type: 'constant', required: true },
                { name: 'length', type: 'constant', required: false },
            ],
        },
        {
            id: 'replace',
            name: 'replace',
            category: 'string',
            description: 'Replaces text patterns',
            parameters: [
                { name: 'source', type: 'source', required: true },
                { name: 'search', type: 'constant', required: true },
                { name: 'replace', type: 'constant', required: true },
            ],
        },
        // Date functions
        {
            id: 'dateFormat',
            name: 'dateFormat',
            category: 'date',
            description: 'Formats dates',
            parameters: [
                { name: 'source', type: 'source', required: true },
                { name: 'sourceFormat', type: 'constant', required: false },
                { name: 'targetFormat', type: 'constant', required: true },
            ],
        },
        // Number functions
        {
            id: 'numberFormat',
            name: 'numberFormat',
            category: 'number',
            description: 'Formats numbers',
            parameters: [
                { name: 'source', type: 'source', required: true },
                { name: 'pattern', type: 'constant', required: false },
            ],
        },
        // Conversion functions
        {
            id: 'convertToString',
            name: 'convertToString',
            category: 'conversion',
            description: 'Converts value to string',
            parameters: [
                { name: 'source', type: 'source', required: true },
            ],
        },
        {
            id: 'convertToNumber',
            name: 'convertToNumber',
            category: 'conversion',
            description: 'Converts value to number',
            parameters: [
                { name: 'source', type: 'source', required: true },
            ],
        },
    ];
}
