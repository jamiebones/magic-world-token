"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatEther, isAddress } from "viem";
import { usePermitOperations } from "@/hooks/usePermitOperations";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { MagicWorldTokenABI } from "@/abis";

interface PermitSignature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  deadline: bigint;
}

export default function PermitDemoPage() {
  const { address } = useAccount();
  const [spenderAddress, setSpenderAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [signature, setSignature] = useState<PermitSignature | null>(null);

  // Get current nonce
  const { data: currentNonce } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN,
    abi: MagicWorldTokenABI,
    functionName: "nonces",
    args: address ? [address] : undefined,
  });

  // Get token balance
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN,
    abi: MagicWorldTokenABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { generatePermitSignature, executePermit, approve, isLoading, error } =
    usePermitOperations();

  const handleGenerateSignature = async () => {
    if (!isAddress(spenderAddress)) {
      alert("Please enter a valid spender address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      const sig = await generatePermitSignature(
        spenderAddress as `0x${string}`,
        amount,
        currentNonce as bigint
      );
      if (sig) {
        setSignature(sig);
      }
    } catch (err) {
      console.error("Failed to generate signature:", err);
    }
  };

  const handleExecutePermit = async () => {
    if (!address || !signature) return;

    try {
      await executePermit(
        address,
        spenderAddress as `0x${string}`,
        amount,
        signature
      );
      setSignature(null); // Clear after execution
      setAmount("");
      setSpenderAddress("");
    } catch (err) {
      console.error("Failed to execute permit:", err);
    }
  };

  const handleTraditionalApprove = async () => {
    if (!isAddress(spenderAddress)) {
      alert("Please enter a valid spender address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      await approve(spenderAddress as `0x${string}`, amount);
      setAmount("");
      setSpenderAddress("");
    } catch (err) {
      console.error("Failed to approve:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            EIP-2612 Permit Demo
          </h1>
          <p className="mt-2 text-gray-600">
            Compare traditional approve vs gasless permit signatures
          </p>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                What is EIP-2612 Permit?
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  EIP-2612 allows token approvals via off-chain signatures
                  instead of on-chain transactions. This means:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    <strong>No gas cost for signing</strong> - The signature is
                    created off-chain
                  </li>
                  <li>
                    <strong>One transaction instead of two</strong> - No
                    separate approve() call needed
                  </li>
                  <li>
                    <strong>Better UX</strong> - Users can approve and transfer
                    in one step
                  </li>
                  <li>
                    <strong>Gasless approvals</strong> - Third parties can pay
                    gas for permit execution
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        {address && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your Account
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {address}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Balance</p>
                <p className="text-sm font-semibold text-gray-900">
                  {balance
                    ? `${Number(
                        formatEther(balance as bigint)
                      ).toLocaleString()} MWG`
                    : "0 MWG"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Nonce</p>
                <p className="text-sm font-semibold text-gray-900">
                  {currentNonce?.toString() || "0"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Traditional Approve */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-600 font-semibold">1</span>
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900">
                Traditional Approve
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Spender Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={spenderAddress}
                  onChange={(e) => setSpenderAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (MWG)
                </label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleTraditionalApprove}
                disabled={isLoading || !address}
                className="w-full bg-gray-600 text-white py-3 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? "Processing..." : "Approve (Pay Gas)"}
              </button>

              <div className="bg-gray-50 rounded-md p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Process:
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>User pays gas for approve() transaction</li>
                  <li>Transaction is mined (~5-15 seconds)</li>
                  <li>Spender can now use transferFrom()</li>
                </ol>
                <p className="text-xs text-gray-500 mt-2">
                  <strong>Gas Cost:</strong> ~46,000 gas (~$0.50-$2.00)
                </p>
              </div>
            </div>
          </div>

          {/* Permit Method */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-blue-300">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold">2</span>
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900">
                Gasless Permit
                <span className="ml-2 text-sm text-blue-600 font-normal">
                  ⚡ Recommended
                </span>
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Spender Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={spenderAddress}
                  onChange={(e) => setSpenderAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (MWG)
                </label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!signature ? (
                <button
                  onClick={handleGenerateSignature}
                  disabled={isLoading || !address}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Step 1: Sign Permit (FREE ⚡)
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <p className="text-sm font-semibold text-green-800 mb-2">
                      ✓ Signature Generated
                    </p>
                    <div className="space-y-2 text-xs font-mono">
                      <div>
                        <span className="text-gray-600">v:</span>{" "}
                        <span className="text-gray-900">{signature.v}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">r:</span>{" "}
                        <span className="text-gray-900 break-all">
                          {signature.r.slice(0, 20)}...
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">s:</span>{" "}
                        <span className="text-gray-900 break-all">
                          {signature.s.slice(0, 20)}...
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">deadline:</span>{" "}
                        <span className="text-gray-900">
                          {new Date(
                            Number(signature.deadline) * 1000
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleExecutePermit}
                    disabled={isLoading}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isLoading ? "Executing..." : "Step 2: Execute Permit"}
                  </button>

                  <button
                    onClick={() => setSignature(null)}
                    className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 text-sm"
                  >
                    Cancel & Generate New
                  </button>
                </div>
              )}

              <div className="bg-blue-50 rounded-md p-4 space-y-2">
                <h3 className="text-sm font-semibold text-blue-900">
                  Process:
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>
                    <strong>Sign permit (FREE)</strong> - Off-chain signature
                  </li>
                  <li>Anyone can execute permit on-chain</li>
                  <li>Approval + transfer in one transaction</li>
                </ol>
                <p className="text-xs text-blue-600 mt-2">
                  <strong>Gas Cost:</strong> ~75,000 gas for permit execution
                  <br />
                  <strong>But:</strong> Signing is FREE! Can be batched with
                  transferFrom
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">
                  {typeof error === "string" ? error : "An error occurred"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        <div className="mt-6 bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Feature Comparison
            </h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Feature
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Traditional Approve
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Permit (EIP-2612)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Gas Cost for User
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                  ~46,000 gas
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600 bg-blue-50">
                  0 gas (signature is free)
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Transactions Required
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                  2 (approve + transferFrom)
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 bg-blue-50">
                  1 (permit can be in same tx)
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  User Experience
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                  Two steps, two waits
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 bg-blue-50">
                  One step (sign + execute)
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Gasless Possibilities
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                  ❌ Not possible
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 bg-blue-50">
                  ✅ 3rd party can pay gas
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Meta-Transactions
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                  ❌ Not supported
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 bg-blue-50">
                  ✅ Fully supported
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Deadline Protection
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                  ❌ No expiration
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 bg-blue-50">
                  ✅ Time-bound signatures
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
