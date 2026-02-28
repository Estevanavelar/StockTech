# ========================================
# STOCKTECH - AvAdmin Client (HTTP Communication)
# ========================================

import asyncio
from typing import Dict, List, Optional, Any
import httpx
from pydantic import BaseModel
from datetime import datetime

from ..core.config import settings
from ..core.logger import logger

# ==========================================
# RESPONSE MODELS (matching AvAdmin schemas)
# ==========================================

class UserData(BaseModel):
    """User data from AvAdmin"""
    id: str
    full_name: str
    cpf: str
    whatsapp: str
    role: str
    account_id: Optional[str] = None
    is_active: bool
    whatsapp_verified: bool
    created_at: datetime

class AccountLimits(BaseModel):
    """Account limits from AvAdmin"""
    max_users: int
    max_products: int
    max_transactions: int
    current_users: int
    current_products: int
    current_transactions: int

class PlanData(BaseModel):
    """Plan data from AvAdmin"""
    id: str
    name: str
    max_users: int
    max_products: int
    max_transactions: int
    features: Dict[str, Any] = {}

class AccountData(BaseModel):
    """Account data from AvAdmin"""
    id: str
    company_name: str
    cnpj: str
    whatsapp: str
    responsible_name: str
    status: str
    enabled_modules: List[str]
    plan: Optional[PlanData] = None
    limits: AccountLimits
    created_at: datetime

class ModulePermission(BaseModel):
    """Module permission response"""
    account_id: str
    module: str
    has_access: bool
    reason: str

# ==========================================
# AVADMIN HTTP CLIENT
# ==========================================

class AvAdminClient:
    """
    HTTP Client for communicating with AvAdmin module
    Handles user validation, account limits, permissions, etc.
    """
    
    def __init__(self):
        self.base_url = settings.AVADMIN_API_URL  # http://avadmin-backend:8000
        self.timeout = 10.0  # 10 seconds timeout
        self.max_retries = 3
        
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to AvAdmin with retry logic"""
        
        url = f"{self.base_url}{endpoint}"
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        json=data,
                        params=params
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                    elif response.status_code == 404:
                        logger.warning(f"Resource not found: {endpoint}")
                        return None
                    elif response.status_code == 403:
                        logger.warning(f"Access denied: {endpoint}")
                        raise PermissionError(f"Access denied to {endpoint}")
                    else:
                        response.raise_for_status()
                        
            except httpx.TimeoutException:
                logger.warning(f"Timeout on attempt {attempt + 1} for {endpoint}")
                if attempt == self.max_retries - 1:
                    raise ConnectionError(f"AvAdmin service timeout after {self.max_retries} attempts")
                await asyncio.sleep(1)  # Wait 1 second before retry
                
            except httpx.ConnectError:
                logger.error(f"Connection error on attempt {attempt + 1} for {endpoint}")
                if attempt == self.max_retries - 1:
                    raise ConnectionError("AvAdmin service is not available")
                await asyncio.sleep(2)  # Wait 2 seconds before retry
                
            except Exception as e:
                logger.error(f"Unexpected error on attempt {attempt + 1}: {str(e)}")
                if attempt == self.max_retries - 1:
                    raise
                await asyncio.sleep(1)
    
    # ==========================================
    # USER METHODS
    # ==========================================
    
    async def get_user(self, user_id: str) -> Optional[UserData]:
        """Get user details by ID"""
        try:
            data = await self._make_request("GET", f"/api/internal/users/{user_id}")
            return UserData(**data) if data else None
        except Exception as e:
            logger.error(f"Failed to get user {user_id}: {str(e)}")
            return None
    
    async def get_user_by_cpf(self, cpf: str) -> Optional[UserData]:
        """Get user by CPF (for authentication)"""
        try:
            data = await self._make_request("GET", f"/api/internal/users/by-cpf/{cpf}")
            return UserData(**data) if data else None
        except Exception as e:
            logger.error(f"Failed to get user by CPF {cpf}: {str(e)}")
            return None
    
    async def get_account_users(self, account_id: str, active_only: bool = True) -> List[UserData]:
        """Get all users from an account"""
        try:
            params = {"active_only": active_only}
            data = await self._make_request("GET", f"/api/internal/accounts/{account_id}/users", params=params)
            
            if data and "users" in data:
                return [UserData(**user) for user in data["users"]]
            return []
        except Exception as e:
            logger.error(f"Failed to get account users {account_id}: {str(e)}")
            return []
    
    # ==========================================
    # ACCOUNT METHODS
    # ==========================================
    
    async def get_account(self, account_id: str) -> Optional[AccountData]:
        """Get account/company details"""
        try:
            data = await self._make_request("GET", f"/api/internal/accounts/{account_id}")
            return AccountData(**data) if data else None
        except Exception as e:
            logger.error(f"Failed to get account {account_id}: {str(e)}")
            return None
    
    async def check_module_permission(self, account_id: str, module: str = "StockTech") -> ModulePermission:
        """Check if account has permission to use module"""
        try:
            params = {"module": module}
            data = await self._make_request("GET", f"/api/internal/accounts/{account_id}/permissions", params=params)
            return ModulePermission(**data) if data else ModulePermission(
                account_id=account_id,
                module=module,
                has_access=False,
                reason="Service unavailable"
            )
        except Exception as e:
            logger.error(f"Failed to check permissions for account {account_id}: {str(e)}")
            return ModulePermission(
                account_id=account_id,
                module=module,
                has_access=False,
                reason="Service error"
            )
    
    async def increment_usage_counter(self, account_id: str, counter_type: str) -> bool:
        """Increment usage counter (products, transactions, etc.)"""
        try:
            await self._make_request("POST", f"/api/internal/accounts/{account_id}/usage/{counter_type}")
            return True
        except Exception as e:
            logger.error(f"Failed to increment {counter_type} counter for account {account_id}: {str(e)}")
            return False
    
    # ==========================================
    # VALIDATION METHODS
    # ==========================================
    
    async def validate_user_access(self, user_id: str, module: str = "StockTech") -> bool:
        """Validate if user has access to module"""
        try:
            data = await self._make_request("POST", "/api/internal/validate/user-access", data={
                "user_id": user_id,
                "module": module
            })
            return data.get("has_access", False) if data else False
        except PermissionError:
            return False
        except Exception as e:
            logger.error(f"Failed to validate user access {user_id}: {str(e)}")
            return False
    
    # ==========================================
    # HEALTH CHECK
    # ==========================================
    
    async def health_check(self) -> bool:
        """Check if AvAdmin service is healthy"""
        try:
            data = await self._make_request("GET", "/api/internal/health")
            return data.get("status") == "healthy" if data else False
        except Exception as e:
            logger.error(f"AvAdmin health check failed: {str(e)}")
            return False

# ==========================================
# SINGLETON INSTANCE
# ==========================================

# Global client instance
avadmin_client = AvAdminClient()

# ==========================================
# CONVENIENCE FUNCTIONS
# ==========================================

async def get_user_data(user_id: str) -> Optional[UserData]:
    """Convenience function to get user data"""
    return await avadmin_client.get_user(user_id)

async def get_account_data(account_id: str) -> Optional[AccountData]:
    """Convenience function to get account data"""
    return await avadmin_client.get_account(account_id)

async def validate_user_module_access(user_id: str, module: str = "StockTech") -> bool:
    """Convenience function to validate user access"""
    return await avadmin_client.validate_user_access(user_id, module)

async def can_create_product(account_id: str) -> bool:
    """Check if account can create more products"""
    account = await get_account_data(account_id)
    if not account:
        return False
    
    limits = account.limits
    return limits.current_products < limits.max_products

async def can_create_transaction(account_id: str) -> bool:
    """Check if account can create more transactions"""
    account = await get_account_data(account_id)
    if not account:
        return False
    
    limits = account.limits
    return limits.current_transactions < limits.max_transactions