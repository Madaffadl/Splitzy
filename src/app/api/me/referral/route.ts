import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateReferralCode, REFERRAL_REWARD_DAYS } from "@/lib/referral";
import { BRAND } from "@/lib/brand";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  let referralCode = user.referralCode;

  if (!referralCode) {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code = generateReferralCode();
      const exists = await prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!exists) break;
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: code },
      select: { referralCode: true },
    });
    referralCode = updated.referralCode;
  }

  const agg = await prisma.referral.aggregate({
    where: { referrerId: user.id },
    _count: { id: true },
    _sum: { rewardDays: true },
  });

  return NextResponse.json({
    code: referralCode,
    referralUrl: `${BRAND.siteUrl}?ref=${referralCode}`,
    rewardDays: REFERRAL_REWARD_DAYS,
    totalReferrals: agg._count.id,
    totalDaysEarned: agg._sum.rewardDays ?? 0,
  });
}
