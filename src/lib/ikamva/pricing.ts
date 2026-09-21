export const HYBRID_PRICING = {
  platform: {
    id: "platform",
    name: "Base Platform Subscription",
    description: "Base Employee + chat",
  },
  addOns: {
    email: {
      id: "email_management",
      name: "Email Management Add-on",
      price: "R499/mo",
      allowance: "Up to 500 tasks",
    },
    calendar: {
      id: "calendar_management",
      name: "Calendar Management Add-on",
      price: "R299/mo",
      allowance: "Calendar scheduling",
    },
  },
} as const;
