/**
 * XSLT Mapping Generator for SAP CPI
 *
 * Generates .xslt (XSLT) files that can be deployed to SAP CPI.
 * XSLT Mappings provide powerful XML transformation capabilities.
 */

export interface XsltMappingDefinition {
    id: string;
    name: string;
    sourceNamespace?: string;
    targetNamespace?: string;
    templates: XsltTemplate[];
    functions?: XsltFunction[];
}

export interface XsltTemplate {
    match: string; // XPath match pattern
    mode?: string; // Optional mode for named templates
    priority?: number;
    content: XsltContent[];
}

export interface XsltContent {
    type: 'element' | 'attribute' | 'text' | 'comment' | 'processingInstruction';
    name?: string;
    namespace?: string;
    value?: string;
    select?: string; // XPath expression
    children?: XsltContent[];
    attributes?: XsltContent[];
}

export interface XsltFunction {
    name: string;
    params: { name: string; type: string }[];
    body: string;
}

/**
 * Generate an XSLT mapping file content
 */
export function generateXsltFile(mapping: XsltMappingDefinition): string {
    const lines: string[] = [];

    // XML declaration and XSLT root
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');

    // XSLT stylesheet header
    if (mapping.sourceNamespace || mapping.targetNamespace) {
        lines.push('<xsl:stylesheet version="2.0"');
        if (mapping.sourceNamespace) {
            lines.push(`  xmlns:src="${mapping.sourceNamespace}"`);
        }
        if (mapping.targetNamespace) {
            lines.push(`  xmlns:tgt="${mapping.targetNamespace}"`);
        }
        lines.push('  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">');
    } else {
        lines.push('<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">');
    }

    // Output configuration
    lines.push('  <xsl:output method="xml" version="1.0" encoding="UTF-8" indent="yes"/>');

    // Custom functions
    if (mapping.functions && mapping.functions.length > 0) {
        for (const func of mapping.functions) {
            lines.push('');
            lines.push(`  <xsl:function name="xsl:${func.name}" as="xs:string">`);
            for (const param of func.params) {
                lines.push(`    <xsl:param name="${param.name}" as="xs:${param.type}"/>`);
            }
            lines.push(`    <xsl:value-of select="${func.body}"/>`);
            lines.push('  </xsl:function>');
        }
    }

    // Root template
    lines.push('');
    lines.push('  <xsl:template match="/">');
    lines.push('    <xsl:apply-templates/>');
    lines.push('  </xsl:template>');

    // Templates
    for (const template of mapping.templates) {
        lines.push('');
        lines.push(`  <xsl:template match="${template.match}"`);

        if (template.mode) {
            lines.push(`               mode="${template.mode}"`);
        }
        if (template.priority !== undefined) {
            lines.push(`               priority="${template.priority}"`);
        }
        lines.push('  >');

        // Generate content
        for (const content of template.content) {
            lines.push(...generateContentXml(content, '    '));
        }

        lines.push('  </xsl:template>');
    }

    lines.push('');
    lines.push('</xsl:stylesheet>');

    return lines.join('\n');
}

/**
 * Generate XSLT content XML
 */
function generateContentXml(content: XsltContent, indent: string): string[] {
    const lines: string[] = [];

    switch (content.type) {
        case 'element':
            let elemLine = `${indent}<xsl:element`;
            if (content.namespace) {
                elemLine += ` namespace="${content.namespace}"`;
            }
            if (content.name) {
                elemLine += ` name="${content.name}"`;
            }
            elemLine += '>';
            lines.push(elemLine);

            if (content.attributes && content.attributes.length > 0) {
                for (const attr of content.attributes) {
                    if (attr.type === 'attribute' && attr.name && attr.select) {
                        lines.push(`${indent}  <xsl:attribute name="${attr.name}" select="${attr.select}"/>`);
                    }
                }
            }

            if (content.children && content.children.length > 0) {
                for (const child of content.children) {
                    lines.push(...generateContentXml(child, indent + '    '));
                }
            } else if (content.select) {
                lines.push(`${indent}  <xsl:value-of select="${content.select}"/>`);
            } else if (content.value) {
                lines.push(`${indent}  ${content.value}`);
            }

            lines.push(`${indent}</xsl:element>`);
            break;

        case 'attribute':
            if (content.name && content.select) {
                lines.push(`${indent}<xsl:attribute name="${content.name}" select="${content.select}"/>`);
            }
            break;

        case 'text':
            if (content.select) {
                lines.push(`${indent}<xsl:value-of select="${content.select}"/>`);
            } else if (content.value) {
                lines.push(`${indent}<xsl:text>${content.value}</xsl:text>`);
            }
            break;

        case 'comment':
            lines.push(`${indent}<xsl:comment>${content.value || ''}</xsl:comment>`);
            break;

        case 'processingInstruction':
            if (content.name && content.value) {
                lines.push(`${indent}<xsl:processing-instruction name="${content.name}">${content.value}</xsl:processing-instruction>`);
            }
            break;
    }

    return lines;
}

/**
 * Convert a simple mapping config to XsltMappingDefinition
 */
export function convertToXsltMappingDefinition(
    mappingId: string,
    mappingName: string,
    sourceXpath: string = '/*',
    targetElement: string = 'result'
): XsltMappingDefinition {
    return {
        id: mappingId,
        name: mappingName,
        templates: [
            {
                match: sourceXpath,
                content: [
                    {
                        type: 'element',
                        name: targetElement,
                        children: [
                            {
                                type: 'text',
                                select: '.',
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

/**
 * Generate a more complex XSLT with conditionals and loops
 */
export function generateConditionalXslt(
    sourceXpath: string,
    targetElement: string,
    conditions: { when: string; then: string }[]
): string {
    const mapping: XsltMappingDefinition = {
        id: 'conditional_mapping',
        name: 'Conditional Mapping',
        templates: [
            {
                match: sourceXpath,
                content: [
                    {
                        type: 'element',
                        name: targetElement,
                        children: conditions.map((cond, index) => ({
                            type: 'element' as const,
                            name: 'item',
                            children: [
                                {
                                    type: 'text' as const,
                                    select: cond.then,
                                },
                            ],
                            attributes: [
                                {
                                    type: 'attribute' as const,
                                    name: 'condition',
                                    select: cond.when,
                                },
                            ],
                        })),
                    },
                ],
            },
        ],
    };

    return generateXsltFile(mapping);
}

/**
 * Common XSLT templates for SAP CPI
 */
export const commonXsltTemplates = {
    // Identity transform (copy all)
    identity: `<xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>`,

    // Remove namespace
    removeNamespaces: `<xsl:template match="*">
    <xsl:element name="{local-name()}">
      <xsl:apply-templates select="@*|node()"/>
    </xsl:element>
  </xsl:template>`,

    // Flatten elements
    flatten: `<xsl:template match="*">
    <xsl:for-each select=".//*">
      <xsl:value-of select="."/>
      <xsl:text> </xsl:text>
    </xsl:for-each>
  </xsl:template>`,

    // Filter elements
    filter: `<xsl:template match="*[not(@remove='true')]">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>`,

    // Merge duplicates
    mergeDuplicates: `<xsl:template match="item[preceding-sibling::*[1]/@id = @id]" priority="1">
    <!-- Skip duplicate -->
  </xsl:template>`,
};
