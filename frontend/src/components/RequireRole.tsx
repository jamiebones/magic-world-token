import React from "react";
import { useAccount } from "wagmi";
import { useRoleGate } from "@/hooks/useRoleGate";

type ContractType = "token" | "game" | "vault";

interface RequireRoleProps {
  contract: ContractType;
  roleConstant: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component to protect content based on role requirements
 * Only renders children if user has the required role
 */
export function RequireRole({
  contract,
  roleConstant,
  children,
  fallback,
}: RequireRoleProps) {
  const { isConnected } = useAccount();
  const { hasRole, isLoading } = useRoleGate({ contract, roleConstant });

  if (!isConnected) {
    return (
      fallback || (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Wallet Not Connected
          </h3>
          <p className="text-gray-400">
            Please connect your wallet to access this admin panel.
          </p>
        </div>
      )
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
        <p className="text-gray-400">Checking permissions...</p>
      </div>
    );
  }

  if (!hasRole) {
    return (
      fallback || (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-red-500/20 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Access Denied
          </h3>
          <p className="text-gray-400 mb-2">
            You do not have the required role to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required role:{" "}
            <code className="px-2 py-1 bg-gray-700 rounded">
              {roleConstant}
            </code>{" "}
            on {contract} contract
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Component to protect content based on multiple role requirements (OR logic)
 * Renders children if user has ANY of the specified roles
 */
interface RequireAnyRoleProps {
  roles: Array<{ contract: ContractType; roleConstant: string }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAnyRole({
  roles,
  children,
  fallback,
}: RequireAnyRoleProps) {
  const { isConnected } = useAccount();

  const roleChecks = roles.map(({ contract, roleConstant }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRoleGate({ contract, roleConstant });
  });

  const isAnyLoading = roleChecks.some((check) => check.isLoading);
  const hasAnyRole = roleChecks.some((check) => check.hasRole);

  if (!isConnected) {
    return (
      fallback || (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Wallet Not Connected
          </h3>
          <p className="text-gray-400">
            Please connect your wallet to access this admin panel.
          </p>
        </div>
      )
    );
  }

  if (isAnyLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
        <p className="text-gray-400">Checking permissions...</p>
      </div>
    );
  }

  if (!hasAnyRole) {
    return (
      fallback || (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-red-500/20 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Access Denied
          </h3>
          <p className="text-gray-400 mb-2">
            You do not have any of the required roles to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required: Admin or Distributor role
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
