import { handlers } from "@/auth";
import { NextResponse } from "next/server";

console.log("🔍 Auth API route loaded");

// 为了让调试日志能输出，包裹一下 handlers
const wrappedHandlers = {
  GET: async (req) => {
    console.log("🔍 GET /api/auth/[...nextauth] called");
    console.log("🔍 Request URL:", req.url);
    try {
      const result = await handlers.GET(req);
      console.log("🔍 GET handler result:", result);
      return result;
    } catch (error) {
      console.error("❌ GET handler error:", error);
      throw error;
    }
  },
  POST: async (req) => {
    console.log("🔍 POST /api/auth/[...nextauth] called");
    console.log("🔍 Request URL:", req.url);
    try {
      const result = await handlers.POST(req);
      console.log("🔍 POST handler result:", result);
      return result;
    } catch (error) {
      console.error("❌ POST handler error:", error);
      throw error;
    }
  },
};

export const GET = wrappedHandlers.GET;
export const POST = wrappedHandlers.POST;