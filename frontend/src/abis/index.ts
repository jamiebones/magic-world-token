import MagicWorldTokenArtifact from './MagicWorldToken.json';
import MagicWorldGameArtifact from './MagicWorldGame.json';
import PartnerVaultArtifact from './PartnerVault.json';

// Export ABIs
export const MagicWorldTokenABI = MagicWorldTokenArtifact.abi;
export const MagicWorldGameABI = MagicWorldGameArtifact.abi;
export const PartnerVaultABI = PartnerVaultArtifact.abi;

// Export full artifacts if needed
export { MagicWorldTokenArtifact, MagicWorldGameArtifact, PartnerVaultArtifact };
