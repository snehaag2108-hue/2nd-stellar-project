#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

// ── helpers ──────────────────────────────────────────────────────────────────

/// Deploy a Stellar asset contract (SAC) and return (contract_address, admin_client).
fn create_token<'a>(env: &'a Env, admin: &Address) -> (Address, token::StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let addr = sac.address();
    let client = token::StellarAssetClient::new(env, &addr);
    (addr, client)
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[test]
fn test_burn_reduces_supply_and_tracks_total() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let (token_addr, token_admin) = create_token(&env, &admin);

    // mint 1000 tokens to user
    let user = Address::generate(&env);
    token_admin.mint(&user, &1000i128);

    // user burns 400
    client.burn(&user, &token_addr, &400i128);

    assert_eq!(client.get_total_burned(&token_addr), 400i128);
    assert_eq!(client.get_user_burned(&token_addr, &user), 400i128);
    assert_eq!(client.get_burn_count(&token_addr), 1u32);
}

#[test]
fn test_multiple_burns_accumulate() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let (token_addr, token_admin) = create_token(&env, &admin);

    let user = Address::generate(&env);
    token_admin.mint(&user, &1000i128);

    client.burn(&user, &token_addr, &100i128);
    client.burn(&user, &token_addr, &200i128);

    assert_eq!(client.get_total_burned(&token_addr), 300i128);
    assert_eq!(client.get_user_burned(&token_addr, &user), 300i128);
    assert_eq!(client.get_burn_count(&token_addr), 2u32);
}

#[test]
fn test_multiple_users_burn_independently() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let (token_addr, token_admin) = create_token(&env, &admin);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    token_admin.mint(&alice, &500i128);
    token_admin.mint(&bob, &500i128);

    client.burn(&alice, &token_addr, &150i128);
    client.burn(&bob, &token_addr, &250i128);

    assert_eq!(client.get_total_burned(&token_addr), 400i128);
    assert_eq!(client.get_user_burned(&token_addr, &alice), 150i128);
    assert_eq!(client.get_user_burned(&token_addr, &bob), 250i128);
    assert_eq!(client.get_burn_count(&token_addr), 2u32);
}

#[test]
fn test_different_tokens_tracked_separately() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let (token_a, ta) = create_token(&env, &admin1);
    let (token_b, tb) = create_token(&env, &admin2);

    let user = Address::generate(&env);
    ta.mint(&user, &1000i128);
    tb.mint(&user, &1000i128);

    client.burn(&user, &token_a, &111i128);
    client.burn(&user, &token_b, &222i128);

    assert_eq!(client.get_total_burned(&token_a), 111i128);
    assert_eq!(client.get_total_burned(&token_b), 222i128);
}

#[test]
fn test_zero_burned_for_new_token() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let unknown_token = Address::generate(&env);

    assert_eq!(client.get_total_burned(&unknown_token), 0i128);
    assert_eq!(client.get_burn_count(&unknown_token), 0u32);
}

#[test]
#[should_panic]
fn test_burn_zero_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let (token_addr, _) = create_token(&env, &admin);

    let user = Address::generate(&env);
    client.burn(&user, &token_addr, &0i128);
}
