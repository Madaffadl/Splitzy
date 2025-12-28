import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
    try {
        const { image } = await request.json();

        if (!image) {
            return NextResponse.json(
                { error: "No image provided" },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "Gemini API key not configured" },
                { status: 500 }
            );
        }

        // Extract base64 data from data URL
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Analyze this receipt image and extract all items with their prices.

Return ONLY a JSON object in this exact format, no other text:
{
  "items": [
    {"name": "Item Name", "qty": 1, "price": 25000}
  ],
  "tax": 0,
  "service": 0
}

Rules:
1. Extract ALL food/drink items from the receipt
2. "price" should be the TOTAL price for that line item (after qty multiplication if shown)
3. "qty" should be the quantity if shown (e.g., "2x Nasi Goreng" = qty:2), default to 1
4. "tax" is the tax amount if shown (may be labeled as Tax, PB1, PPN, Pajak)
5. "service" is the service charge if shown (may be labeled as Service, SC, Service Charge)
6. All prices should be numbers without currency symbols or thousand separators
7. Do NOT include subtotals, totals, payment methods, or change
8. If you cannot read the receipt clearly, return {"items": [], "tax": 0, "service": 0}

Extract the items now:`;

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: base64Data,
                },
            },
            prompt,
        ]);

        const response = await result.response;
        const text = response.text();

        // Parse the JSON response
        // Try to extract JSON from the response (Gemini might include markdown)
        let jsonStr = text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        try {
            const parsed = JSON.parse(jsonStr);

            // Validate the response structure
            if (!parsed.items || !Array.isArray(parsed.items)) {
                return NextResponse.json({
                    items: [],
                    tax: 0,
                    service: 0,
                    raw: text,
                });
            }

            // Clean up and validate items
            const cleanedItems = parsed.items
                .filter((item: { name?: string; price?: number }) => item.name && typeof item.price === 'number' && item.price > 0)
                .map((item: { name: string; qty?: number; price: number }) => ({
                    name: String(item.name).trim(),
                    qty: Math.max(1, parseInt(String(item.qty)) || 1),
                    price: parseFloat(String(item.price)) || 0,
                }));

            return NextResponse.json({
                items: cleanedItems,
                tax: parseFloat(String(parsed.tax)) || 0,
                service: parseFloat(String(parsed.service)) || 0,
            });
        } catch {
            console.error("Failed to parse Gemini response:", text);
            return NextResponse.json({
                items: [],
                tax: 0,
                service: 0,
                error: "Failed to parse response",
                raw: text,
            });
        }
    } catch (error) {
        console.error("Gemini API error:", error);
        return NextResponse.json(
            { error: "Failed to process image", details: String(error) },
            { status: 500 }
        );
    }
}
