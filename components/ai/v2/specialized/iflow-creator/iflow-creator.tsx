"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PackageSelection, IFlowDescription, IFlowDesign, UserModifications, CreationResult, WizardState } from "./types";
import { PackageSelectionStep } from "./steps/package-selection";
import { DescriptionInputStep } from "./steps/description-input";
import { AIDesignReviewStep } from "./steps/ai-design-review";
import { ApprovalReview } from "./steps/approval-review";
import { CreationProgress } from "./steps/creation-progress";
import { createIFlowInSAPCPI } from "@/app/actions/create-iflow";
import { Check } from "lucide-react";

interface IFlowCreatorProps {
    tenantId: string;
}

const STEPS = [
    { number: 1, name: "Package", description: "Choose package" },
    { number: 2, name: "Description", description: "Describe iFlow" },
    { number: 3, name: "Design", description: "AI generates design" },
    { number: 4, name: "Review", description: "Review & approve" },
    { number: 5, name: "Create", description: "Deploy to SAP CPI" },
];

export function IFlowCreator({ tenantId }: IFlowCreatorProps) {
    const [wizardState, setWizardState] = useState<WizardState>({
        currentStep: 1,
    });

    const updatePackageSelection = (selection: PackageSelection) => {
        setWizardState(prev => ({
            ...prev,
            packageSelection: selection,
        }));
    };

    const updateDescription = (description: IFlowDescription) => {
        setWizardState(prev => ({
            ...prev,
            description,
        }));
    };

    const updateDesign = (design: IFlowDesign) => {
        setWizardState(prev => ({
            ...prev,
            design,
        }));
    };

    const updateModifications = (modifications: UserModifications) => {
        setWizardState(prev => ({
            ...prev,
            modifications,
        }));
    };

    const updateResult = (result: CreationResult) => {
        setWizardState(prev => ({
            ...prev,
            result,
        }));
    };

    const goToStep = (step: number) => {
        setWizardState(prev => ({
            ...prev,
            currentStep: step,
        }));
    };

    const nextStep = () => {
        setWizardState(prev => ({
            ...prev,
            currentStep: Math.min(prev.currentStep + 1, STEPS.length),
        }));
    };

    const previousStep = () => {
        setWizardState(prev => ({
            ...prev,
            currentStep: Math.max(prev.currentStep - 1, 1),
        }));
    };

    const handleApprove = async () => {
        if (!wizardState.packageSelection || !wizardState.design) {
            return;
        }

        // Move to creation step
        nextStep();

        // Call the server action to create the iFlow
        const result = await createIFlowInSAPCPI(
            tenantId,
            wizardState.packageSelection,
            wizardState.design
        );

        // Update the result
        updateResult(result);
    };

    const handleReset = () => {
        setWizardState({
            currentStep: 1,
        });
    };

    const progress = ((wizardState.currentStep - 1) / (STEPS.length - 1)) * 100;

    return (
        <div className="container max-w-6xl mx-auto py-8 space-y-8">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">iFlow Creator</h1>
                <p className="text-muted-foreground">
                    Create SAP CPI integration flows using AI-powered design
                </p>
            </div>

            {/* Progress Steps */}
            <Card className="p-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, index) => (
                            <div key={step.number} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`
                                            w-10 h-10 rounded-full flex items-center justify-center font-semibold
                                            transition-colors duration-200
                                            ${wizardState.currentStep > step.number
                                                ? 'bg-primary text-primary-foreground'
                                                : wizardState.currentStep === step.number
                                                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                                                    : 'bg-muted text-muted-foreground'
                                            }
                                        `}
                                    >
                                        {wizardState.currentStep > step.number ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            step.number
                                        )}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <p className={`text-sm font-medium ${wizardState.currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                                            }`}>
                                            {step.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground hidden sm:block">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div
                                        className={`
                                            h-0.5 flex-1 mx-2 transition-colors duration-200
                                            ${wizardState.currentStep > step.number
                                                ? 'bg-primary'
                                                : 'bg-muted'
                                            }
                                        `}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            </Card>

            {/* Step Content */}
            <Card className="p-8">
                {wizardState.currentStep === 1 && (
                    <PackageSelectionStep
                        tenantId={tenantId}
                        value={wizardState.packageSelection}
                        onChange={updatePackageSelection}
                        onNext={nextStep}
                    />
                )}

                {wizardState.currentStep === 2 && (
                    <DescriptionInputStep
                        value={wizardState.description}
                        onChange={updateDescription}
                        onNext={nextStep}
                        onBack={previousStep}
                    />
                )}

                {wizardState.currentStep === 3 && wizardState.description && (
                    <AIDesignReviewStep
                        description={wizardState.description}
                        value={wizardState.design}
                        onChange={updateDesign}
                        onNext={nextStep}
                        onBack={previousStep}
                    />
                )}

                {wizardState.currentStep === 4 && (
                    <ApprovalReview
                        state={wizardState}
                        onBack={previousStep}
                        onApprove={handleApprove}
                    />
                )}

                {wizardState.currentStep === 5 && (
                    <CreationProgress
                        result={wizardState.result}
                        onReset={handleReset}
                    />
                )}
            </Card>

            {/* Debug Info (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
                <Card className="p-4 bg-muted">
                    <details>
                        <summary className="cursor-pointer font-medium">Debug: Wizard State</summary>
                        <pre className="mt-2 text-xs overflow-auto">
                            {JSON.stringify(wizardState, null, 2)}
                        </pre>
                    </details>
                </Card>
            )}
        </div>
    );
}