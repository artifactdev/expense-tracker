import { prisma } from '@/lib/prisma';
import type { EnhancedSubscription, Subscription } from '@/types';

type UpdateUserTransactionsDateProps = {
  userId: string;
  transactionsDate: { from: string; to: string } | null;
};

type AddSubscriptionToUserParams = {
  userId: string;
  subscription: Subscription;
};

type UpdateSubscriptionToUserParams = {
  userId: string;
  subscription: EnhancedSubscription;
};

type DeleteSubscriptionToUserParams = {
  userId: string;
  subscriptionIds: string[];
};

export const updateUserTransactionsDate = async ({
  userId,
  transactionsDate,
}: UpdateUserTransactionsDateProps) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      transactionsDateFrom: transactionsDate?.from ?? null,
      transactionsDateTo: transactionsDate?.to ?? null,
    },
  });
};

export const getUserTransactionsDate = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { transactionsDateFrom: true, transactionsDateTo: true },
  });
  if (!user) return null;
  if (!user.transactionsDateFrom || !user.transactionsDateTo) return null;
  return { from: user.transactionsDateFrom, to: user.transactionsDateTo };
};

export const getUserCategories = async (userId: string) => {
  const userCats = await prisma.userCategory.findMany({
    where: { userId },
    include: { category: true },
  });
  return userCats.map(({ category }) => ({
    id: category.id,
    name: category.name,
    common: category.common,
  }));
};

export const getUsersSubscriptions = async (userId: string) => {
  return prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
};

export const addSubscriptionToUser = async ({
  userId,
  subscription,
}: AddSubscriptionToUserParams) => {
  return prisma.subscription.create({
    data: {
      userId,
      name: subscription.name,
      price: subscription.price,
      startDate: subscription.startDate,
      billingPeriod: subscription.billingPeriod,
      autoRenew: subscription.autoRenew,
      notify: subscription.notify,
      status: subscription.status,
      notes: subscription.notes ?? null,
    },
  });
};

export const updateSubscription = async ({
  userId,
  subscription,
}: UpdateSubscriptionToUserParams) => {
  return prisma.subscription.updateMany({
    where: { id: subscription._id as string, userId },
    data: {
      name: subscription.name,
      price: subscription.price,
      startDate: subscription.startDate,
      billingPeriod: subscription.billingPeriod,
      autoRenew: subscription.autoRenew,
      notify: subscription.notify,
      status: subscription.status,
      notes: subscription.notes ?? null,
    },
  });
};

export const deleteSubscriptions = async ({
  userId,
  subscriptionIds,
}: DeleteSubscriptionToUserParams) => {
  return prisma.subscription.deleteMany({
    where: { id: { in: subscriptionIds }, userId },
  });
};
