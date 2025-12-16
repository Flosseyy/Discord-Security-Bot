import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const dataDir = join(process.cwd(), 'data');
const permissionsFile = join(dataDir, 'guild-permissions.json');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const DEFAULT_PERMISSIONS = {
  MESSAGE_SECURITY_ENABLED: true,
  ALT_DETECTION_ENABLED: true,
  MASS_KICK_ENABLED: true,
  MASS_BAN_ENABLED: true,
  VANITY_PROTECTION_ENABLED: true,
  ROLE_MONITOR_ENABLED: true,
  CHANNEL_MONITOR_ENABLED: true,
  MEMBER_UPDATE_ENABLED: true,
  SERVER_SETTINGS_ENABLED: true,
  INTEGRATION_MONITOR_ENABLED: true,
  BLOCK_LINKS: true,
  ENABLE_BLACKLIST: true,
  AUTO_DELETE_VIOLATIONS: true,
  AUTO_DELETE_CHANNELS: false,
  AUTO_DELETE_ROLES: false,
  AUTO_DELETE_WEBHOOKS: false,
  SERVER_SCAN_ENABLED: true,
  ANTI_BOT_ENABLED: true
};

const DEFAULT_ROLES = {
  CENSOR_MODERATOR_ROLES: [],
  MESSAGE_SECURITY_BYPASS_ROLES: [],
  ALT_DETECTION_BYPASS_ROLES: [],
  MASS_KICK_BYPASS_ROLES: [],
  MASS_BAN_BYPASS_ROLES: [],
  VANITY_PROTECTION_BYPASS_ROLES: [],
  ROLE_MONITOR_BYPASS_ROLES: [],
  CHANNEL_MONITOR_BYPASS_ROLES: [],
  MEMBER_UPDATE_BYPASS_ROLES: [],
  SERVER_SETTINGS_BYPASS_ROLES: [],
  INTEGRATION_MONITOR_BYPASS_ROLES: [],
  UNIVERSAL_BYPASS_ROLE: null
};

function loadGuildPermissions() {
  if (!existsSync(permissionsFile)) {
    return {};
  }
  
  try {
    return JSON.parse(readFileSync(permissionsFile, 'utf8'));
  } catch (error) {
    console.error('Error loading guild permissions:', error);
    return {};
  }
}

function saveGuildPermissions(permissions) {
  try {
    writeFileSync(permissionsFile, JSON.stringify(permissions, null, 2));
  } catch (error) {
    console.error('Error saving guild permissions:', error);
  }
}

export function getGuildPermission(guildId, permission) {
  const allPermissions = loadGuildPermissions();
  const guildPerms = allPermissions[guildId] || {};
  
  return guildPerms[permission] !== undefined ? guildPerms[permission] : DEFAULT_PERMISSIONS[permission];
}

export function setGuildPermission(guildId, permission, value) {
  const allPermissions = loadGuildPermissions();
  
  if (!allPermissions[guildId]) {
    allPermissions[guildId] = {};
  }
  
  allPermissions[guildId][permission] = value;
  saveGuildPermissions(allPermissions);
}

export function getAvailablePermissions() {
  return Object.keys(DEFAULT_PERMISSIONS);
}

export function getAvailableRoles() {
  return Object.keys(DEFAULT_ROLES);
}

export function getGuildRole(guildId, roleType) {
  const allPermissions = loadGuildPermissions();
  const guildPerms = allPermissions[guildId] || {};
  
  return guildPerms[roleType] !== undefined ? guildPerms[roleType] : DEFAULT_ROLES[roleType];
}

export function setGuildRole(guildId, roleType, roleIds) {
  const allPermissions = loadGuildPermissions();
  
  if (!allPermissions[guildId]) {
    allPermissions[guildId] = {};
  }
  
  allPermissions[guildId][roleType] = roleIds;
  saveGuildPermissions(allPermissions);
}

export function addRoleToGuildRole(guildId, roleType, roleId) {
  const currentRoles = getGuildRole(guildId, roleType) || [];
  if (!currentRoles.includes(roleId)) {
    currentRoles.push(roleId);
    setGuildRole(guildId, roleType, currentRoles);
  }
}

export function removeRoleFromGuildRole(guildId, roleType, roleId) {
  const currentRoles = getGuildRole(guildId, roleType) || [];
  const newRoles = currentRoles.filter(id => id !== roleId);
  setGuildRole(guildId, roleType, newRoles);
}

export function getGuildUser(guildId, bypassType) {
  const allPermissions = loadGuildPermissions();
  const guildPerms = allPermissions[guildId] || {};
  const userBypasses = guildPerms.userBypasses || {};
  return userBypasses[bypassType] || [];
}

export function setGuildUser(guildId, bypassType, userIds) {
  const allPermissions = loadGuildPermissions();
  
  if (!allPermissions[guildId]) {
    allPermissions[guildId] = {};
  }
  
  if (!allPermissions[guildId].userBypasses) {
    allPermissions[guildId].userBypasses = {};
  }
  
  allPermissions[guildId].userBypasses[bypassType] = userIds;
  saveGuildPermissions(allPermissions);
}

export function hasBypassPermission(guild, member, permissionType) {
  // Check role bypasses first
  const roleBypass = getGuildRole(guild.id, `${permissionType}_ROLES`) || [];
  if (member.roles.cache.some(role => roleBypass.includes(role.id))) {
    return true;
  }

  // Check user bypasses
  const userBypass = getGuildUser(guild.id, `${permissionType}_ROLES`) || [];
  return userBypass.includes(member.id);
}

export function getGuildPermissions(guildId) {
  const allPermissions = loadGuildPermissions();
  const guildPerms = allPermissions[guildId] || {};
  
  const result = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_PERMISSIONS)) {
    result[key] = guildPerms[key] !== undefined ? guildPerms[key] : defaultValue;
  }
  
  return result;
}
