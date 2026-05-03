import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  notes: string;
}

export interface StatementData {
  accountInfo: {
    address: string;
    accountNumber: string;
    period: string;
  };
  transactions: Transaction[];
}

export enum FileType {
  PDF = "application/pdf",
  IMAGE_PNG = "image/png",
  IMAGE_JPEG = "image/jpeg",
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    accountInfo: {
      type: Type.OBJECT,
      properties: {
        address: {
          type: Type.STRING,
          description: "The primary address or billing address found on the statement",
        },
        accountNumber: {
          type: Type.STRING,
          description: "The account number (partially masked if necessary)",
        },
        period: {
          type: Type.STRING,
          description: "The statement period or date range",
        },
      },
    },
    transactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: {
            type: Type.STRING,
            description: "Transaction date in YYYY-MM-DD format",
          },
          description: {
            type: Type.STRING,
            description: "Full transaction description or merchant name",
          },
          amount: {
            type: Type.NUMBER,
            description: "Amount (positive for deposits, negative for expenses)",
          },
          category: {
            type: Type.STRING,
            description: "Transaction category (e.g., Groceries, Rent, Salary, Bills)",
          },
          notes: {
            type: Type.STRING,
            description: "Relevant notes or additional info found in the description",
          },
        },
        required: ["date", "description", "amount", "category"],
      },
    },
  },
  required: ["accountInfo", "transactions"],
};

export interface FileData {
  base64Data: string;
  mimeType: string;
}

export async function extractTransactions(
  files: FileData[]
): Promise<StatementData> {
  try {
    const parts = files.map((f) => ({
      inlineData: {
        data: f.base64Data,
        mimeType: f.mimeType,
      },
    }));

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          parts: [
            ...parts,
            {
              text: `Extract ALL transactions and statement information from these provided documents. 
              Requirements:
              - Date format: YYYY-MM-DD
              - Amount: Positive for deposits, negative for expenses
              - Category: Auto-detect (Groceries, Dining, Transport, Salary, Bills, Entertainment, Health, Shopping, Misc)
              - Skip headers, totals, summary tables, and non-transaction rows.
              - Also extract the account holder address, account number, and statement period.
              - Output a consolidated JSON object.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as StatementData;
  } catch (error) {
    console.error("Extraction error:", error);
    throw error;
  }
}

export function convertToCSV(transactions: Transaction[]): string {
  const headers = ["Date", "Description", "Amount", "Category", "Notes"];
  const rows = transactions.map((t) => [
    t.date,
    `"${t.description.replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    t.category,
    `"${(t.notes || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
