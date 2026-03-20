#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    TotalBurned(Address),         // total burned per token
    UserBurned(Address, Address), // burned per (token, user)
    BurnCount(Address),           // number of burn events per token
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Burns `amount` of `token` from `caller`.
    /// Fully permissionless — anyone can burn their own tokens.
    pub fn burn(env: Env, caller: Address, token_addr: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        caller.require_auth();

        // call SEP-41 burn on the token contract
        token::Client::new(&env, &token_addr).burn(&caller, &amount);

        // update total burned for this token
        let total_key = DataKey::TotalBurned(token_addr.clone());
        let total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&total_key, &(total + amount));

        // update per-user burned
        let user_key = DataKey::UserBurned(token_addr.clone(), caller.clone());
        let user_total: i128 = env.storage().persistent().get(&user_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&user_key, &(user_total + amount));

        // increment burn count
        let count_key = DataKey::BurnCount(token_addr.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(count + 1));
    }

    /// Returns total tokens burned for a given token contract.
    pub fn get_total_burned(env: Env, token_addr: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalBurned(token_addr))
            .unwrap_or(0)
    }

    /// Returns how many tokens a specific user has burned for a given token.
    pub fn get_user_burned(env: Env, token_addr: Address, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::UserBurned(token_addr, user))
            .unwrap_or(0)
    }

    /// Returns the number of burn events recorded for a given token.
    pub fn get_burn_count(env: Env, token_addr: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::BurnCount(token_addr))
            .unwrap_or(0)
    }
}

mod test;
