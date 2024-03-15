import React from "react";
import { getUserSubscriptionPlan } from "../../../lib/stripe";
import BillingForm from "../../../components/BillingForm";

type Props = {};

async function Page({}: Props) {
  const subscriptionPlan = await getUserSubscriptionPlan();
  return <BillingForm subscriptionPlan={subscriptionPlan} />;
}

export default Page;
