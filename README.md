# Haggle

A RevenueCat Shipaton 2026 entry. Enter a recurring bill (cable, phone, insurance, medical, rent), get an AI-generated negotiation script plus the provider's retention-department contact and best time to call.

## Why this exists

Every existing bill-negotiation service (BillShark, BillCutterz, Trim, Experian BillFixer) works the same way: they negotiate on your behalf and take 30-50% of whatever you save, or bundle it into a paid membership. None of them sell a flat-subscription, do-it-yourself tool. Haggle does the negotiation homework for you — you make the call.

## Monetization

- First bill script: free (see the value before paying)
- Premium: unlimited bill scripts, renegotiation reminders every 6-12 months, a running "money saved" tracker
- Powered by RevenueCat for subscription management

## Status

Early scaffold. See `.claude` for project-specific Claude Code tooling (Expo plugin enabled).

## Stack

- Expo (React Native + TypeScript)
- EAS Build for Android/iOS builds (no local Android Studio/Xcode required)
- RevenueCat SDK for in-app purchases
