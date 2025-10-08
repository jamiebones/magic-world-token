const mongoose = require('mongoose');
const crypto = require('crypto');

const walletSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomUUID()
    },
    address: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: props => `${props.value} is not a valid Ethereum address!`
        }
    },
    encryptedPrivateKey: {
        type: String,
        required: true
    },
    // IV for decryption
    iv: {
        type: String,
        required: true
    },



}, {
    timestamps: true
});

// Indexes (address already has unique: true, so no need to add separate index)
walletSchema.index({ createdAt: -1 });

// Don't return sensitive data by default
walletSchema.methods.toJSON = function () {
    const obj = this.toObject();
    // Never expose encrypted private key in JSON responses
    delete obj.encryptedPrivateKey;
    delete obj.iv;
    delete obj.__v;
    return obj;
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
