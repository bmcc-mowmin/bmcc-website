-- AlterTable
ALTER TABLE "CheckoutSession" ADD COLUMN     "providerAccount" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "providerAccount" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "providerAccount" TEXT;
