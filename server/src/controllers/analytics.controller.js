import { Campaign } from '../models/Campaign.js';

function normalizeCount(value) {
  return Number.isFinite(value) ? value : 0;
}

export async function getAnalyticsSummary(req, res, next) {
  try {
    const campaigns = await Campaign.find({ userId: req.userId })
      .select('name status stats recipientContactIds createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    const summary = campaigns.reduce(
      (acc, campaign) => {
        const total = normalizeCount(
          campaign.stats?.total ?? campaign.recipientContactIds?.length ?? 0,
        );
        const sent = normalizeCount(campaign.stats?.sent ?? 0);
        const failed = normalizeCount(campaign.stats?.failed ?? 0);

        acc.totalCampaigns += 1;
        acc.totalRecipients += total;
        acc.totalSent += sent;
        acc.totalFailed += failed;

        if (campaign.status === 'pending') acc.pendingCampaigns += 1;
        else if (campaign.status === 'processing') acc.processingCampaigns += 1;
        else if (campaign.status === 'completed') acc.completedCampaigns += 1;

        return acc;
      },
      {
        totalCampaigns: 0,
        totalRecipients: 0,
        totalSent: 0,
        totalFailed: 0,
        pendingCampaigns: 0,
        processingCampaigns: 0,
        completedCampaigns: 0,
      },
    );

    const deliveryRate =
      summary.totalRecipients > 0 ? (100 * summary.totalSent) / summary.totalRecipients : 0;
    const failureRate =
      summary.totalRecipients > 0 ? (100 * summary.totalFailed) / summary.totalRecipients : 0;
    const successDenominator = summary.totalSent + summary.totalFailed;
    const successRate =
      successDenominator > 0 ? (100 * summary.totalSent) / successDenominator : 0;

    const recentCampaigns = campaigns.slice(0, 7).map((campaign) => {
      const total = normalizeCount(
        campaign.stats?.total ?? campaign.recipientContactIds?.length ?? 0,
      );
      const sent = normalizeCount(campaign.stats?.sent ?? 0);
      const failed = normalizeCount(campaign.stats?.failed ?? 0);
      return {
        id: String(campaign._id),
        name: campaign.name,
        status: campaign.status,
        total,
        sent,
        failed,
        updatedAt: campaign.updatedAt || campaign.createdAt || null,
      };
    });

    res.json({
      summary: {
        ...summary,
        deliveryRate,
        failureRate,
        successRate,
      },
      recentCampaigns,
      statusBreakdown: [
        { label: 'Pending', value: summary.pendingCampaigns },
        { label: 'Processing', value: summary.processingCampaigns },
        { label: 'Completed', value: summary.completedCampaigns },
      ],
    });
  } catch (err) {
    next(err);
  }
}