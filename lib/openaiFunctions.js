// lib/openaiFunctions.js
export const generateJournalTool = {
  type: 'function',          // Mark this as a function tool
  function: {
    name: 'generate_guided_journal',
    description: 'Generate a structured guided journal (title, description, tableOfContents) based on a given topic',
    strict: true,             // Ensure we get strictly valid JSON
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The topic for the guided journal (e.g., "Illusion of Victimhood").'
        }
      },
      required: ['topic'],
      additionalProperties: false
    }
  }
};
